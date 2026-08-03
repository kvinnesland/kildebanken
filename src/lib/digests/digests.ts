import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLogs,
  countries,
  digestDeliveries,
  digests,
  emailSubscriptions,
  journalistProfiles,
  requests,
  users,
} from "@/db/schema";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { sendBulkEmail } from "@/lib/email/send";
import {
  insertPerRecipientTokens,
  renderDigestContent,
  SITE_ORIGIN,
  type DigestRequestItem,
  type RenderedDigest,
} from "@/lib/email/digest";
import { checkModeratorForCountry, getAssignedCountryCodes } from "@/lib/auth/authorize";
import type { CurrentSession } from "@/lib/auth/session";

export interface DigestListItem {
  id: string;
  countryCode: string;
  scheduledFor: string;
  requestIds: string[];
  recipientCount: number;
  status: "pending" | "sending" | "sent" | "failed";
  sentAt: Date | null;
  createdAt: Date;
  // Utledet fra DigestDelivery.status (19.10), for 16.2s "antall sendt,
  // bounces, klager" — IKKE lagret på selve Digest-raden.
  sentCount: number;
  bouncedCount: number;
  complainedCount: number;
  failedCount: number;
}

/** GET /admin/digests (SPEC-V1.md 16.2: "se siste digester per land, antall
 * sendt, bounces, klager") — filtrert på moderatorens tildelte land, samme
 * mønster som `listModerationQueue()` i src/lib/moderation/requests.ts. */
export async function listDigests(session: CurrentSession): Promise<DigestListItem[]> {
  const assigned = await getAssignedCountryCodes(session);
  if (assigned !== "all" && assigned.length === 0) return [];

  const digestRows =
    assigned === "all"
      ? await db.select().from(digests)
      : await db.select().from(digests).where(inArray(digests.countryCode, assigned));

  if (digestRows.length === 0) return [];

  // Én gruppert spørring for ALLE digester i listen, ikke N+1 — samme
  // begrunnelse som ellers i kodebasen (se f.eks. requests/page.tsx sin
  // ene countries-spørring for hele køen).
  const digestIds = digestRows.map((d) => d.id);
  const statusCounts = await db
    .select({ digestId: digestDeliveries.digestId, status: digestDeliveries.status, value: count() })
    .from(digestDeliveries)
    .where(inArray(digestDeliveries.digestId, digestIds))
    .groupBy(digestDeliveries.digestId, digestDeliveries.status);

  const countsByDigest = new Map<string, Partial<Record<string, number>>>();
  for (const row of statusCounts) {
    const existing = countsByDigest.get(row.digestId) ?? {};
    existing[row.status] = row.value;
    countsByDigest.set(row.digestId, existing);
  }

  return digestRows.map((d) => {
    const c = countsByDigest.get(d.id) ?? {};
    return {
      ...d,
      // "sendt" i 16.2s forstand: mottatt av leverandøren, uansett om et
      // etterfølgende delivered-webhook-kall også er mottatt — sent OG
      // delivered telles derfor sammen her, siden delivered kun betyr "vi
      // fikk ENDA en bekreftelse", ikke "sending feilet et sted underveis".
      sentCount: (c.sent ?? 0) + (c.delivered ?? 0),
      bouncedCount: c.bounced ?? 0,
      complainedCount: c.complained ?? 0,
      failedCount: c.failed ?? 0,
    };
  });
}

export type RetryDigestResult =
  | { ok: true; retried: number }
  | { ok: false; error: string };

/**
 * POST /admin/digests/:id/retry (SPEC-V1.md 16.2: "kjør på nytt ved feil").
 * Sender KUN på nytt til mottakere hvis forrige `DigestDelivery` har
 * status `failed` — ikke til de som allerede fikk den, for å unngå dobbel
 * levering ved en delvis mislykket utsendelse ("failed bare når ALLE
 * mottakere feilet" gjelder `Digest.status`, ikke enkeltleveranser — se
 * `sendDigestToRecipients()` i src/lib/jobs/tick.ts).
 *
 * Duplikerer bevisst noe rendrings-/sendelogikk fra `tick.ts` fremfor å
 * refaktorere den delte funksjonen midt i en lang autonom økt — risikoen
 * ved å røre en allerede testet og gjennomgått kjerneflyt (selve
 * digest-utsendelsen) oppveier gevinsten av mindre duplisering her.
 * Notert i NATTLOGG.md som en kandidat for opprydding i dagslys.
 */
export async function retryFailedDigestDeliveries(digestId: string): Promise<RetryDigestResult> {
  const [digest] = await db.select().from(digests).where(eq(digests.id, digestId)).limit(1);
  if (!digest) return { ok: false, error: "errors.not_found" };

  // FR-023: en moderator tildelt et ANNET land skal få errors.not_found
  // (404), ikke errors.not_authorized (403) — se checkModeratorForCountry()
  // i auth/authorize.ts for hvorfor.
  const check = await checkModeratorForCountry(digest.countryCode);
  if (check.status === "unauthorized") return { ok: false, error: "errors.not_authorized" };
  if (check.status === "wrong_country") return { ok: false, error: "errors.not_found" };
  const session = check.session;

  // SPEC-V1.md 10.4: samme lokaliserte From-navn/Reply-To som selve
  // førstegangsutsendelsen (tick.ts) — en gjensending skal ikke se
  // annerledes ut for mottakeren enn originalen ville gjort.
  const [country] = await db
    .select({
      senderNameKey: countries.senderNameKey,
      supportEmail: countries.supportEmail,
      timezone: countries.timezone,
    })
    .from(countries)
    .where(eq(countries.code, digest.countryCode))
    .limit(1);
  if (!country) return { ok: false, error: "errors.not_found" };

  const failedDeliveries = await db
    .select({
      deliveryId: digestDeliveries.id,
      userId: digestDeliveries.userId,
      locale: digestDeliveries.locale,
      email: users.email,
    })
    .from(digestDeliveries)
    .innerJoin(users, eq(digestDeliveries.userId, users.id))
    .where(and(eq(digestDeliveries.digestId, digestId), eq(digestDeliveries.status, "failed")));

  if (failedDeliveries.length === 0) return { ok: true, retried: 0 };

  const requestRows = await db
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
    .where(inArray(requests.id, digest.requestIds));

  const digestItems: DigestRequestItem[] = [];
  for (const r of requestRows) {
    if (!r.slug || !r.title || !r.summary || !r.responseDeadline) continue;
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

  const renderedByLocale = new Map<string, RenderedDigest>();
  const senderNameByLocale = new Map<string, string>();
  let retriedCount = 0;

  for (const delivery of failedDeliveries) {
    const locale = isSupportedLocale(delivery.locale) ? delivery.locale : PLATFORM_DEFAULT_LOCALE;
    if (!renderedByLocale.has(locale)) {
      renderedByLocale.set(
        locale,
        renderDigestContent(locale, digestItems, country.timezone, digest.scheduledFor)
      );
      senderNameByLocale.set(locale, createTranslator(locale)(country.senderNameKey));
    }
    const rendered = renderedByLocale.get(locale);
    if (!rendered) continue;

    const accessToken = generateToken();
    const unsubscribeToken = generateToken();

    try {
      // status="failed" i WHERE-betingelsen (ikke bare i spørringen over som
      // hentet listen) lar denne leveransen "kreves" atomisk — uten den
      // kunne to samtidige kall (f.eks. en administrator som dobbeltklikker
      // "kjør på nytt") begge ha hentet SAMME liste med mislykkede
      // leveranser og begge sendt til samme mottaker, stikk i strid med
      // funksjonens egen uttalte hensikt om å unngå dobbel levering.
      const [claimed] = await db
        .update(digestDeliveries)
        .set({ status: "queued", accessTokenHash: hashToken(accessToken), errorMessage: null })
        .where(and(eq(digestDeliveries.id, delivery.deliveryId), eq(digestDeliveries.status, "failed")))
        .returning({ id: digestDeliveries.id });
      if (!claimed) continue;

      // Samme rotasjon som ved førstegangsutsendelse — den forrige
      // (mislykkede) e-postens avmeldingslenke, om den noen gang ble
      // generert, skal ikke lenger virke.
      await db
        .update(emailSubscriptions)
        .set({ unsubscribeTokenHash: hashToken(unsubscribeToken), lastDigestAt: new Date() })
        .where(eq(emailSubscriptions.userId, delivery.userId));

      const personalized = insertPerRecipientTokens(rendered, accessToken, unsubscribeToken);

      const providerMessageId = await sendBulkEmail({
        to: { email: delivery.email, locale },
        subject: personalized.subject,
        html: personalized.html,
        text: personalized.text,
        // FR-038, samme som førstegangsutsendelsen i tick.ts.
        listUnsubscribeUrl: `${SITE_ORIGIN}/api/unsubscribe/${unsubscribeToken}`,
        // SPEC-V1.md 10.4, samme som førstegangsutsendelsen i tick.ts.
        senderName: senderNameByLocale.get(locale) ?? country.senderNameKey,
        replyTo: country.supportEmail,
      });

      // provider_message_id, samme begrunnelse som førstegangsutsendelsen i
      // tick.ts — uten den kan ikke en senere bounce/klage på DENNE
      // gjensendingen kobles til riktig DigestDelivery-rad.
      await db
        .update(digestDeliveries)
        .set({ status: "sent", providerMessageId })
        .where(eq(digestDeliveries.id, delivery.deliveryId));
      retriedCount += 1;
    } catch (err) {
      await db
        .update(digestDeliveries)
        .set({ status: "failed", errorMessage: (err as Error).message })
        .where(eq(digestDeliveries.id, delivery.deliveryId));
    }
  }

  if (retriedCount > 0) {
    await db
      .update(digests)
      .set({ status: "sent", recipientCount: digest.recipientCount + retriedCount })
      .where(eq(digests.id, digestId));
  }

  // FR-050. Manglet frem til nå — samme klasse av hull som resten av
  // src/lib/admin/ (se NATTLOGG.md, økt 7).
  await db.insert(auditLogs).values({
    actorType: "user",
    actorUserId: session.userId,
    countryCode: digest.countryCode,
    action: "digest.retry",
    entityType: "digest",
    entityId: digestId,
    metadata: { retried: retriedCount, failedFound: failedDeliveries.length },
  });

  return { ok: true, retried: retriedCount };
}
