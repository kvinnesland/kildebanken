// Ren, vert-uvitende jobblogikk. Denne filen vet ingenting om Netlify,
// pg-boss, eller cron — den blir kalt av en tynn adapter (i dag
// netlify/functions/tick.ts, senere en pg-boss-lytteprosess eller en
// cron-linje på Hetzner). Se INFRASTRUCTURE.md 16.3 og 16.8.
//
// Hvert kall gjør én sjekk-og-utfør-runde per jobbtype og avslutter — ingen
// bakgrunnsprosess, ingen tilstand holdt i minnet mellom kall. All idempotens
// ligger i databasen (unike indekser, statussjekk før overgang), ikke i at
// denne funksjonen "husker" noe fra forrige kall.

import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import {
  contactRequests,
  countries,
  digestDeliveries,
  digests,
  emailSubscriptions,
  journalistProfiles,
  requests,
  users,
} from "@/db/schema";
import { sendTransactionalEmail, sendBulkEmail } from "@/lib/email/send";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { runRetention } from "@/lib/jobs/retention";
import {
  insertPerRecipientTokens,
  renderDigestContent,
  type DigestRequestItem,
  type RenderedDigest,
} from "@/lib/email/digest";

export interface TickResult {
  job: string;
  processed: number;
  errors: string[];
}

export interface TickSummary {
  ranAt: string;
  results: TickResult[];
}

/**
 * Hoveduttrykket for hele Stadium 0-jobbmodellen. Kalles hvert 15. minutt av
 * adapteren. Se INFRASTRUCTURE.md 5.1 for jobbtabellen dette dekker.
 */
export async function runTick(): Promise<TickSummary> {
  const results: TickResult[] = [];

  results.push(await runDigestTick(db));
  results.push(await runExpireRequests(db));
  results.push(await runExpireContactRequests(db));
  results.push(await runDeadlineReminders(db));
  results.push(await runStaleRequestReminders(db));

  // Disse kjører daglig, ikke hvert 15. minutt — men siden hvert kall bare
  // gjør én sjekk og avslutter (ingen egen scheduler-tilstand i Stadium 0),
  // styres frekvensen av en enkel klokkeslett-vakt i selve funksjonen. Se
  // shouldRunDailyJobNow() under.
  if (shouldRunDailyJobNow()) {
    results.push(await runPurgeUnverified(db));

    // retention (SPEC-V1.md 17.4) kjører nå, men i "dry run" som standard —
    // se src/lib/jobs/retention.ts. Den teller og logger hva den ville
    // gjort, og sletter/anonymiserer ingenting med mindre
    // RETENTION_DRY_RUN=false er eksplisitt satt i miljøet. Ikke koblet til
    // noe ekte miljø ennå.
    const retentionSummary = await runRetention(db);
    results.push({
      job: "retention",
      processed: retentionSummary.results.reduce((sum, r) => sum + r.affectedCount, 0),
      errors: retentionSummary.results.flatMap((r) =>
        r.errors.map((e) => `${r.category}: ${e}`)
      ),
    });
    if (retentionSummary.dryRun) {
      console.log(
        "[retention] dry run — ingenting slettet.",
        JSON.stringify(retentionSummary.results)
      );
    }
  }

  return { ranAt: new Date().toISOString(), results };
}

/** Kjør de daglige jobbene i det 15-minutters-vinduet nærmest 03:00 UTC. */
function shouldRunDailyJobNow(): boolean {
  const hour = new Date().getUTCHours();
  const minute = new Date().getUTCMinutes();
  return hour === 3 && minute < 15;
}

// ---------------------------------------------------------------------------
// digest-tick — se INFRASTRUCTURE.md 5.2
// ---------------------------------------------------------------------------

async function runDigestTick(dbase: Database): Promise<TickResult> {
  const errors: string[] = [];
  let processed = 0;

  const activeCountries = await dbase
    .select()
    .from(countries)
    .where(eq(countries.status, "active"));

  for (const country of activeCountries) {
    try {
      const { localDate, localTimeHHMM } = localTimeForTimezone(country.timezone);

      if (localTimeHHMM < country.digestSendTime) continue;

      const existing = await dbase
        .select({ id: digests.id })
        .from(digests)
        .where(
          and(
            eq(digests.countryCode, country.code),
            eq(digests.scheduledFor, localDate)
          )
        )
        .limit(1);

      if (existing.length > 0) continue; // allerede sendt for i dag i dette landet

      const publishable = await dbase
        .select({ id: requests.id })
        .from(requests)
        .where(
          and(
            eq(requests.countryCode, country.code),
            eq(requests.status, "published"),
            isNull(requests.includedInDigestAt)
          )
        );

      if (publishable.length === 0) continue; // ingen nye — ikke send tomt

      // Den unike indeksen digests_country_scheduled_for_idx (schema.ts)
      // gjør dette trygt mot to overlappende tikk: kolliderer innsettingen,
      // har et annet tikk allerede vunnet kappløpet, og vi gjør ingenting mer.
      const [createdDigest] = await dbase
        .insert(digests)
        .values({
          countryCode: country.code,
          scheduledFor: localDate,
          requestIds: publishable.map((r) => r.id),
          status: "pending",
        })
        .onConflictDoNothing()
        .returning({ id: digests.id });

      if (!createdDigest) continue; // tapte kappløpet mot et parallelt tikk

      const requestIds = publishable.map((r) => r.id);
      await dbase
        .update(requests)
        .set({ includedInDigestAt: new Date() })
        .where(sql`${requests.id} = ANY(${requestIds})`);

      const sendErrors = await sendDigestToRecipients(dbase, {
        digestId: createdDigest.id,
        country: country.code,
        requestIds,
      });
      errors.push(...sendErrors);

      processed += 1;
    } catch (err) {
      errors.push(`${country.code}: ${(err as Error).message}`);
      // Bevisst: feil i ett land stopper ikke de andre (FR-036).
    }
  }

  return { job: "digest-tick", processed, errors };
}

/**
 * Finner faktiske mottakere, rendrer én variant per locale i bruk (FR-032),
 * og sender. Skilt ut fra `runDigestTick` bare for lesbarhet — samme
 * transaksjonelle enhet (ett land, ett tikk).
 */
async function sendDigestToRecipients(
  dbase: Database,
  args: { digestId: string; country: string; requestIds: string[] }
): Promise<string[]> {
  const errors: string[] = [];

  const requestRows = await dbase
    .select({
      id: requests.id,
      slug: requests.slug,
      title: requests.title,
      summary: requests.summary,
      responseDeadline: requests.responseDeadline,
      geographicNote: requests.geographicNote,
      contentLanguage: requests.contentLanguage,
      organizationName: journalistProfiles.organizationName,
    })
    .from(requests)
    .innerJoin(journalistProfiles, eq(requests.journalistId, journalistProfiles.userId))
    .where(inArray(requests.id, args.requestIds));

  // Feltene under er nullable i skjemaet (kun påkrevd fra innsending,
  // FR-021 — se SPEC-V1.md 19.6), men enhver rad her har status `published`,
  // som ikke er nåbart uten å ha bestått nettopp den valideringen. Ikke-null
  // er derfor en reell invariant her, ikke en antagelse — men brytes den
  // likevel (f.eks. ved en fremtidig kode-feil), skal vi hoppe over raden
  // og feile synlig i stedet for å sende en tom digest-post.
  const digestItems: DigestRequestItem[] = [];
  for (const r of requestRows) {
    if (!r.slug || !r.title || !r.summary || !r.responseDeadline) {
      errors.push(`forespørsel ${r.id}: mangler påkrevde felt til tross for status published`);
      continue;
    }
    digestItems.push({
      id: r.id,
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      organizationName: r.organizationName,
      responseDeadline: r.responseDeadline,
      geographicNote: r.geographicNote,
      contentLanguage: r.contentLanguage,
    });
  }

  // Aktivt abonnement OG aktiv konto, i riktig land (FR-031, FR-035).
  const recipients = await dbase
    .select({
      userId: users.id,
      email: users.email,
      locale: users.locale,
      subscriptionId: emailSubscriptions.id,
    })
    .from(users)
    .innerJoin(emailSubscriptions, eq(emailSubscriptions.userId, users.id))
    .where(
      and(
        eq(users.role, "recipient"),
        eq(users.countryCode, args.country),
        eq(users.status, "active"),
        eq(emailSubscriptions.status, "active")
      )
    );

  if (recipients.length === 0) return errors;

  // Rendrer én gang per locale FAKTISK i bruk blant mottakerne (FR-032),
  // ikke én gang per mottaker og ikke for hele SUPPORTED_LOCALES.
  const renderedByLocale = new Map<string, RenderedDigest>();
  for (const recipient of recipients) {
    const locale = isSupportedLocale(recipient.locale) ? recipient.locale : PLATFORM_DEFAULT_LOCALE;
    if (!renderedByLocale.has(locale)) {
      renderedByLocale.set(locale, renderDigestContent(locale, digestItems));
    }
  }

  let sentCount = 0;

  for (const recipient of recipients) {
    const locale = isSupportedLocale(recipient.locale) ? recipient.locale : PLATFORM_DEFAULT_LOCALE;
    const rendered = renderedByLocale.get(locale);
    if (!rendered) continue; // kan ikke skje — men aldri kast for ett locale-oppslag

    const accessToken = generateToken();
    // Avmeldingstokenet roteres ved hver utsendelse — forrige e-posts lenke
    // slutter dermed å virke, uten at noen aktivt måtte tilbakekalle den.
    // Se src/lib/email/digest.ts.
    const unsubscribeToken = generateToken();

    let deliveryId: string | undefined;
    try {
      const [delivery] = await dbase
        .insert(digestDeliveries)
        .values({
          digestId: args.digestId,
          userId: recipient.userId,
          locale,
          accessTokenHash: hashToken(accessToken),
          status: "queued",
        })
        .returning({ id: digestDeliveries.id });
      if (!delivery) throw new Error("insert av DigestDelivery returnerte ingen rad");
      deliveryId = delivery.id;

      await dbase
        .update(emailSubscriptions)
        .set({ unsubscribeTokenHash: hashToken(unsubscribeToken), lastDigestAt: new Date() })
        .where(eq(emailSubscriptions.id, recipient.subscriptionId));

      const personalized = insertPerRecipientTokens(rendered, accessToken, unsubscribeToken);

      await sendBulkEmail({
        to: { email: recipient.email, locale },
        subject: personalized.subject,
        html: personalized.html,
        text: personalized.text,
      });

      await dbase.update(digestDeliveries).set({ status: "sent" }).where(eq(digestDeliveries.id, deliveryId));
      sentCount += 1;
    } catch (err) {
      const message = (err as Error).message;
      errors.push(`mottaker ${recipient.userId}: ${message}`);
      // Én mottakers feil stopper ikke resten av landets utsendelse (FR-036
      // gjelder land — samme prinsipp håndheves her på mottakernivå).
      if (deliveryId) {
        await dbase
          .update(digestDeliveries)
          .set({ status: "failed", errorMessage: message })
          .where(eq(digestDeliveries.id, deliveryId));
      }
    }
  }

  // "failed" bare når ALLE mottakere feilet — delvis feil (noen sendt, noen
  // ikke) er fortsatt en vellykket digest sett fra landets side, med feilene
  // synlige i errors[] og på hver enkelt DigestDelivery.status.
  const digestStatus = sentCount === 0 && recipients.length > 0 ? "failed" : "sent";

  await dbase
    .update(digests)
    .set({ recipientCount: sentCount, status: digestStatus, sentAt: new Date() })
    .where(eq(digests.id, args.digestId));

  return errors;
}

// ---------------------------------------------------------------------------
// expire-requests — FR-026
// ---------------------------------------------------------------------------

async function runExpireRequests(dbase: Database): Promise<TickResult> {
  const now = new Date();
  const expired = await dbase
    .update(requests)
    .set({ status: "expired", closedAt: now })
    .where(and(eq(requests.status, "published"), lt(requests.responseDeadline, now)))
    .returning({ id: requests.id });

  return { job: "expire-requests", processed: expired.length, errors: [] };
}

// ---------------------------------------------------------------------------
// expire-contact-requests — FR-046 (14 dager)
// ---------------------------------------------------------------------------

async function runExpireContactRequests(dbase: Database): Promise<TickResult> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const expired = await dbase
    .update(contactRequests)
    .set({ status: "expired" })
    .where(
      and(
        eq(contactRequests.status, "pending"),
        lt(contactRequests.createdAt, fourteenDaysAgo)
      )
    )
    .returning({ id: contactRequests.id });

  return { job: "expire-contact-requests", processed: expired.length, errors: [] };
}

// ---------------------------------------------------------------------------
// deadline-reminder — varsel 24t før frist
// ---------------------------------------------------------------------------

async function runDeadlineReminders(dbase: Database): Promise<TickResult> {
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const errors: string[] = [];
  let processed = 0;

  // deadlineReminderSentAt (SPEC-V1.md 19.6) gjør dette trygt å kjøre hvert
  // 15. minutt uten å sende samme påminnelse flere ganger — erstatter det
  // tidligere tidsvindu-hacket.
  const soon = await dbase
    .select({ id: requests.id, journalistId: requests.journalistId })
    .from(requests)
    .where(
      and(
        eq(requests.status, "published"),
        lt(requests.responseDeadline, in24h),
        isNull(requests.deadlineReminderSentAt)
      )
    );

  for (const r of soon) {
    try {
      const [journalist] = await dbase
        .select({ email: users.email, locale: users.locale })
        .from(users)
        .where(eq(users.id, r.journalistId));
      if (!journalist) continue;

      await sendTransactionalEmail({
        template: "deadline_approaching_24h",
        to: { email: journalist.email, locale: journalist.locale },
        data: { requestId: r.id },
      });
      await dbase
        .update(requests)
        .set({ deadlineReminderSentAt: new Date() })
        .where(eq(requests.id, r.id));
      processed += 1;
    } catch (err) {
      errors.push(`${r.id}: ${(err as Error).message}`);
    }
  }

  return { job: "deadline-reminder", processed, errors };
}

// ---------------------------------------------------------------------------
// stale-request-reminder — SPEC-V1.md 9.2 / 26.1 punkt 6 (30 dager, ingen
// automatisk lukking)
// ---------------------------------------------------------------------------

async function runStaleRequestReminders(dbase: Database): Promise<TickResult> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const errors: string[] = [];
  let processed = 0;

  // staleReminderSentAt (SPEC-V1.md 19.6) — samme mønster som
  // deadlineReminderSentAt over. Sendes én gang per forespørsel, ikke
  // gjentatt frem til den lukkes.
  const stale = await dbase
    .select({ id: requests.id, journalistId: requests.journalistId })
    .from(requests)
    .where(
      and(
        eq(requests.status, "published"),
        lt(requests.publishedAt, thirtyDaysAgo),
        isNull(requests.staleReminderSentAt)
      )
    );

  for (const r of stale) {
    try {
      const [journalist] = await dbase
        .select({ email: users.email, locale: users.locale })
        .from(users)
        .where(eq(users.id, r.journalistId));
      if (!journalist) continue;

      await sendTransactionalEmail({
        template: "stale_request_reminder_30d",
        to: { email: journalist.email, locale: journalist.locale },
        data: { requestId: r.id },
      });
      await dbase
        .update(requests)
        .set({ staleReminderSentAt: new Date() })
        .where(eq(requests.id, r.id));
      processed += 1;
    } catch (err) {
      errors.push(`${r.id}: ${(err as Error).message}`);
    }
  }

  return { job: "stale-request-reminder", processed, errors };
}

// ---------------------------------------------------------------------------
// purge-unverified — FR-004 (14 dager), kjøres daglig
// ---------------------------------------------------------------------------

async function runPurgeUnverified(dbase: Database): Promise<TickResult> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const deleted = await dbase
    .delete(users)
    .where(
      and(
        eq(users.status, "pending_email_verification"),
        lt(users.createdAt, fourteenDaysAgo)
      )
    )
    .returning({ id: users.id });

  return { job: "purge-unverified", processed: deleted.length, errors: [] };
}

// ---------------------------------------------------------------------------
// Hjelpefunksjon: lokal dato/klokkeslett for en IANA-tidssone, uten
// avhengighet utover Node sin innebygde Intl (Node 20+).
// ---------------------------------------------------------------------------

export function localTimeForTimezone(timeZone: string): {
  localDate: string; // YYYY-MM-DD
  localTimeHHMM: string; // HH:MM, 24-timers
} {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((p) => [p.type, p.value])
  );
  return {
    localDate: `${parts.year}-${parts.month}-${parts.day}`,
    localTimeHHMM: `${parts.hour}:${parts.minute}`,
  };
}
