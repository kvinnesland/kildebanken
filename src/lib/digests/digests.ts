import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLogs,
  digestDeliveries,
  digests,
  emailSubscriptions,
  journalistProfiles,
  requests,
  users,
} from "@/db/schema";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { sendBulkEmail } from "@/lib/email/send";
import {
  insertPerRecipientTokens,
  renderDigestContent,
  type DigestRequestItem,
  type RenderedDigest,
} from "@/lib/email/digest";
import { getAssignedCountryCodes, requireModeratorForCountry } from "@/lib/auth/authorize";
import type { CurrentSession } from "@/lib/auth/session";

/** GET /admin/digests (SPEC-V1.md 16.2: "se siste digester per land, antall
 * sendt, bounces, klager") — filtrert på moderatorens tildelte land, samme
 * mønster som `listModerationQueue()` i src/lib/moderation/requests.ts. */
export async function listDigests(session: CurrentSession) {
  const assigned = await getAssignedCountryCodes(session);
  if (assigned !== "all" && assigned.length === 0) return [];
  if (assigned === "all") return db.select().from(digests);

  return db.select().from(digests).where(inArray(digests.countryCode, assigned));
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

  const session = await requireModeratorForCountry(digest.countryCode);
  if (!session) return { ok: false, error: "errors.not_authorized" };

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
  let retriedCount = 0;

  for (const delivery of failedDeliveries) {
    const locale = isSupportedLocale(delivery.locale) ? delivery.locale : PLATFORM_DEFAULT_LOCALE;
    if (!renderedByLocale.has(locale)) {
      renderedByLocale.set(locale, renderDigestContent(locale, digestItems));
    }
    const rendered = renderedByLocale.get(locale);
    if (!rendered) continue;

    const accessToken = generateToken();
    const unsubscribeToken = generateToken();

    try {
      await db
        .update(digestDeliveries)
        .set({ status: "queued", accessTokenHash: hashToken(accessToken), errorMessage: null })
        .where(eq(digestDeliveries.id, delivery.deliveryId));

      // Samme rotasjon som ved førstegangsutsendelse — den forrige
      // (mislykkede) e-postens avmeldingslenke, om den noen gang ble
      // generert, skal ikke lenger virke.
      await db
        .update(emailSubscriptions)
        .set({ unsubscribeTokenHash: hashToken(unsubscribeToken), lastDigestAt: new Date() })
        .where(eq(emailSubscriptions.userId, delivery.userId));

      const personalized = insertPerRecipientTokens(rendered, accessToken, unsubscribeToken);

      await sendBulkEmail({
        to: { email: delivery.email, locale },
        subject: personalized.subject,
        html: personalized.html,
        text: personalized.text,
      });

      await db
        .update(digestDeliveries)
        .set({ status: "sent" })
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
