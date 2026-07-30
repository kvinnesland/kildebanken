import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { consentRecords, countries, journalistProfiles, suppressions, users } from "@/db/schema";
import { requestMagicLink } from "@/lib/auth/magic-link";
import { getCurrentLegalDocument } from "@/lib/legal/documents";
import { isUniqueViolation } from "@/db/errors";
import { hashToken } from "@/lib/auth/tokens";

export interface ApplyAsJournalistInput {
  fullName: string;
  jobEmail: string;
  jobTitle: string;
  organizationName: string;
  organizationUrl: string;
  countryCode: string;
  locale: string;
  consentJournalistTerms: boolean;
}

export type ApplyAsJournalistResult = { ok: true } | { ok: false; error: string };

export async function applyAsJournalist(
  input: ApplyAsJournalistInput
): Promise<ApplyAsJournalistResult> {
  if (!input.consentJournalistTerms) {
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

  const journalistTermsDoc = await getCurrentLegalDocument(
    input.countryCode,
    input.locale,
    "journalist_terms"
  );
  if (!journalistTermsDoc) return { ok: false, error: "errors.legal_documents_unavailable" };

  // 10.3/19.13: sperrelisten er rolleuavhengig — se presiseringen i
  // SPEC-V1.md 19.13 (økt 7). Samme sjekk, samme rekkefølge (FØR
  // allerede-registrert-sjekken under), som i mottakerregistreringen.
  const [suppressed] = await db
    .select({ id: suppressions.id })
    .from(suppressions)
    .where(eq(suppressions.emailHash, hashToken(input.jobEmail)))
    .limit(1);
  if (suppressed) return { ok: false, error: "errors.email_suppressed" };

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.jobEmail))
    .limit(1);
  if (existing) return { ok: false, error: "errors.email_already_registered" };

  try {
    const [user] = await db
      .insert(users)
      .values({
        email: input.jobEmail,
        role: "journalist",
        status: "pending_email_verification",
        countryCode: input.countryCode,
        locale: input.locale,
        displayName: input.fullName,
      })
      .returning({ id: users.id });
    if (!user) throw new Error("insert av bruker returnerte ingen rad");

    // verification_status defaulter til "pending_review" i skjemaet
    // (SPEC-V1.md 8.1, rettet økt 3) — settes IKKE her, uavhengig av
    // e-postbekreftelse.
    await db.insert(journalistProfiles).values({
      userId: user.id,
      fullName: input.fullName,
      jobTitle: input.jobTitle,
      organizationName: input.organizationName,
      organizationUrl: input.organizationUrl,
    });

    await db.insert(consentRecords).values({
      userId: user.id,
      consentType: "journalist_terms",
      legalDocumentId: journalistTermsDoc.id,
      countryCode: input.countryCode,
      locale: input.locale,
      granted: true,
      grantedAt: new Date(),
      source: "registration_form",
    });

    await requestMagicLink(input.jobEmail);

    return { ok: true };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "errors.email_already_registered" };
    }
    throw err;
  }
}
