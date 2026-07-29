// Ren, vert-uvitende jobblogikk. Denne filen vet ingenting om Netlify,
// pg-boss, eller cron — den blir kalt av en tynn adapter (i dag
// netlify/functions/tick.ts, senere en pg-boss-lytteprosess eller en
// cron-linje på Hetzner). Se INFRASTRUCTURE.md 16.3 og 16.8.
//
// Hvert kall gjør én sjekk-og-utfør-runde per jobbtype og avslutter — ingen
// bakgrunnsprosess, ingen tilstand holdt i minnet mellom kall. All idempotens
// ligger i databasen (unike indekser, statussjekk før overgang), ikke i at
// denne funksjonen "husker" noe fra forrige kall.

import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import {
  contactRequests,
  countries,
  digests,
  requests,
  users,
} from "@/db/schema";
import { sendTransactionalEmail } from "@/lib/email/send";

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
    // retention (SPEC-V1.md 17.4) er bevisst IKKE implementert i dette
    // scaffoldet — sletting/anonymisering av ekte personopplysninger skal
    // ikke kjøre før datamodellen er testet grundig mot et testmiljø. Se
    // NATTLOGG.md.
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

      await dbase
        .update(requests)
        .set({ includedInDigestAt: new Date() })
        .where(
          sql`${requests.id} = ANY(${publishable.map((r) => r.id)})`
        );

      // TODO (neste iterasjon): finn faktiske mottakere (aktivt abonnement,
      // riktig land), rendre én variant per locale i bruk (FR-032), send via
      // Brevo, og opprett DigestDelivery-rader. Se SPEC-V1.md 10.1 og 10.2.
      processed += 1;
    } catch (err) {
      errors.push(`${country.code}: ${(err as Error).message}`);
      // Bevisst: feil i ett land stopper ikke de andre (FR-036).
    }
  }

  return { job: "digest-tick", processed, errors };
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
