import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { consentRecords, countries, emailSubscriptions, users } from "@/db/schema";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { requestMagicLink } from "@/lib/auth/magic-link";
import { getRequiredLegalDocuments } from "@/lib/legal/documents";
import { isUniqueViolation } from "@/db/errors";

export interface RegisterRecipientInput {
  email: string;
  countryCode: string;
  locale: string;
  displayName?: string;
  // SPEC-V1.md 7.1 — tre obligatoriske, ikke-forhåndsavkryssede samtykker.
  // consentTerms dekker ÉN kombinert avkryssingsboks som gjelder to
  // dokumenttyper (terms + privacy) — se 19.11 og kommentaren under.
  consentEmailSubscription: boolean;
  consentTerms: boolean;
  consentMinimumAge: boolean;
}

export type RegisterRecipientResult =
  | { ok: true }
  | { ok: false; error: string };

export async function registerRecipient(
  input: RegisterRecipientInput
): Promise<RegisterRecipientResult> {
  // Ingen av de tre kan være forhåndsavkrysset i klienten, men vi håndhever
  // det også her — en klient som sender "true" uten at bruker faktisk
  // krysset av, er et klientbrudd, ikke noe serveren kan oppdage direkte.
  // Det serveren KAN håndheve er at feltet faktisk er `true`, ikke fraværende.
  if (!input.consentEmailSubscription || !input.consentTerms || !input.consentMinimumAge) {
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

  // FR-009: ingen registrering i en locale der vilkår/personvern mangler.
  const docs = await getRequiredLegalDocuments(input.countryCode, input.locale, [
    "terms",
    "privacy",
  ]);
  if (!docs) return { ok: false, error: "errors.legal_documents_unavailable" };

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);
  if (existing) return { ok: false, error: "errors.email_already_registered" };

  try {
    const [user] = await db
      .insert(users)
      .values({
        email: input.email,
        role: "recipient",
        status: "pending_email_verification",
        countryCode: input.countryCode,
        locale: input.locale,
        displayName: input.displayName,
      })
      .returning({ id: users.id });
    if (!user) throw new Error("insert av bruker returnerte ingen rad");

    const unsubscribeToken = generateToken();
    await db.insert(emailSubscriptions).values({
      userId: user.id,
      status: "active",
      unsubscribeTokenHash: hashToken(unsubscribeToken),
    });

    const now = new Date();
    // ÉN avkrysningsboks (consentTerms), TO ConsentRecord-rader — terms og
    // privacy versjoneres og kan endres uavhengig av hverandre (19.2), selv
    // om brukeren samtykker til begge i samme klikk.
    await db.insert(consentRecords).values([
      {
        userId: user.id,
        consentType: "email_subscription",
        countryCode: input.countryCode,
        locale: input.locale,
        granted: true,
        grantedAt: now,
        source: "registration_form",
      },
      {
        userId: user.id,
        consentType: "terms",
        legalDocumentId: docs.terms?.id,
        countryCode: input.countryCode,
        locale: input.locale,
        granted: true,
        grantedAt: now,
        source: "registration_form",
      },
      {
        userId: user.id,
        consentType: "privacy",
        legalDocumentId: docs.privacy?.id,
        countryCode: input.countryCode,
        locale: input.locale,
        granted: true,
        grantedAt: now,
        source: "registration_form",
      },
      {
        userId: user.id,
        consentType: "minimum_age",
        countryCode: input.countryCode,
        locale: input.locale,
        granted: true,
        grantedAt: now,
        source: "registration_form",
      },
    ]);

    // Sender "confirm_email"-malen (kontoen er ferdig ny, emailVerifiedAt er
    // tom) — se tolkningen dokumentert i src/lib/auth/magic-link.ts.
    await requestMagicLink(input.email);

    return { ok: true };
  } catch (err) {
    // Dekker race conditions mot den tidligere sjekken over (to samtidige
    // registreringer med samme e-post) — databasens unike constraint er den
    // egentlige garantien, sjekken over er bare en tidlig, vennligere feilvei.
    if (isUniqueViolation(err)) {
      return { ok: false, error: "errors.email_already_registered" };
    }
    throw err;
  }
}
