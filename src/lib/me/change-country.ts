import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { consentRecords, countries, users } from "@/db/schema";
import { getRequiredLegalDocuments } from "@/lib/legal/documents";

export interface ChangeCountryInput {
  countryCode: string;
  locale: string;
  // ÉN avkrysningsboks, samme mønster som registrering (7.1) — dekker BÅDE
  // vilkår og personvernerklæring for det nye landet (7.3, punkt 1).
  consentTerms: boolean;
}

export type ChangeCountryResult = { ok: true } | { ok: false; error: string };

/**
 * POST /me/change-country (SPEC-V1.md 7.3, FR-010). Kun mottakere — en
 * journalist kan ikke bytte land selv, det krever ny moderatorvurdering
 * (7.3, siste avsnitt). Håndhevet av ruten (session.role), ikke her, samme
 * fordeling av ansvar som resten av kodebasen (ruten avgjør ROLLE, biblioteket
 * avgjør FORRETNINGSREGLENE for den gitte brukeren).
 *
 * FR-010: nekter brukeren de nye vilkårene, skal `country_code` stå
 * UENDRET — samtykket sjekkes derfor FØR noe som helst skrives.
 */
export async function changeCountry(
  userId: string,
  input: ChangeCountryInput
): Promise<ChangeCountryResult> {
  if (!input.consentTerms) {
    return { ok: false, error: "errors.consent_required" };
  }

  const [country] = await db
    .select()
    .from(countries)
    .where(and(eq(countries.code, input.countryCode), eq(countries.status, "active")));
  if (!country) return { ok: false, error: "errors.invalid_country" };
  if (!country.availableLocales.includes(input.locale)) {
    return { ok: false, error: "errors.invalid_locale" };
  }

  const docs = await getRequiredLegalDocuments(input.countryCode, input.locale, [
    "terms",
    "privacy",
  ]);
  if (!docs) return { ok: false, error: "errors.legal_documents_unavailable" };

  const now = new Date();

  // "Det gamle markeres som tilbaketrukket" (7.3, punkt 1) — bare
  // terms/privacy, IKKE email_subscription eller minimum_age, som ikke er
  // knyttet til et bestemt land og derfor fortsatt gjelder.
  await db
    .update(consentRecords)
    .set({ withdrawnAt: now })
    .where(
      and(
        eq(consentRecords.userId, userId),
        isNull(consentRecords.withdrawnAt),
        inArray(consentRecords.consentType, ["terms", "privacy"])
      )
    );

  await db.insert(consentRecords).values([
    {
      userId,
      consentType: "terms",
      legalDocumentId: docs.terms?.id,
      countryCode: input.countryCode,
      locale: input.locale,
      granted: true,
      grantedAt: now,
      source: "country_change",
    },
    {
      userId,
      consentType: "privacy",
      legalDocumentId: docs.privacy?.id,
      countryCode: input.countryCode,
      locale: input.locale,
      granted: true,
      grantedAt: now,
      source: "country_change",
    },
  ]);

  // Abonnementet flyttes til det nye landets digest "fra neste utsendelse"
  // (7.3, punkt 2) uten noen egen handling her — digest-jobben grupperer på
  // users.country_code direkte (ingen egen landkobling på
  // email_subscriptions), så denne oppdateringen ALENE er nok. Allerede
  // innsendte svar rører vi bevisst ikke (7.3, punkt 3 — blir liggende hos
  // journalistene som mottok dem).
  await db
    .update(users)
    .set({ countryCode: input.countryCode, locale: input.locale, updatedAt: now })
    .where(eq(users.id, userId));

  return { ok: true };
}
