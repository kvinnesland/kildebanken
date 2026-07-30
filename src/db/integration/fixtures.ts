// Hjelpefunksjoner for integrasjonstester (npm run test:integration).
// Krever DATABASE_URL satt til en ekte, disponibel Postgres — se
// vitest.integration.config.ts og NATTLOGG.md, økt 7.
//
// Dette er IKKE ment som et fullverdig testrammeverk (ingen
// transaksjons-rollback per test ennå) — rader lages med tilfeldige,
// unike verdier per kall for å unngå kollisjon mellom tester, men ryddes
// ikke automatisk opp. Greit for en engangs, disponibel sandkasse-database;
// bør erstattes med transaksjonsrollback eller en fersk database per
// testkjøring (f.eks. en Neon-branch) i en ekte CI-oppsett.

import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { countries, journalistProfiles, legalDocuments, users } from "@/db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL må være satt for å kjøre integrasjonstester — se vitest.integration.config.ts."
  );
}

export const TEST_COUNTRY_CODE = "XT"; // "test", aldri et ekte ISO 3166-1-kodenavn i bruk
export const TEST_COUNTRY_CODE_2 = "XU"; // et ANNET testland, for landbytte-tester

/**
 * Oppretter (eller gjenbruker) et testland med status `active` og
 * gyldige, publiserte juridiske dokumenter for `nb-NO` — uten disse
 * kommer ingen registreringsflyt gjennom (FR-009).
 */
export async function ensureTestCountry(): Promise<void> {
  await ensureCountryWithDocuments(TEST_COUNTRY_CODE);
}

/** Et ANNET testland enn `ensureTestCountry()`, for å teste landbytte
 * (`changeCountry()`, SPEC-V1.md 7.3) — trenger to distinkte, aktive land
 * med egne juridiske dokumenter for å bevise at det faktisk bytter til RIKTIG
 * lands dokumenter, ikke bare at feltet endres. */
export async function ensureSecondTestCountry(): Promise<void> {
  await ensureCountryWithDocuments(TEST_COUNTRY_CODE_2);
}

async function ensureCountryWithDocuments(countryCode: string): Promise<void> {
  await db
    .insert(countries)
    .values({
      code: countryCode,
      nameKey: "country.test.name",
      defaultLocale: "nb-NO",
      availableLocales: ["nb-NO", "en-GB"],
      timezone: "Europe/Oslo",
      minimumAge: 18,
      digestSendTime: "07:00",
      senderNameKey: "email.sender_name.test",
      supportEmail: "test@example.invalid",
      status: "active",
    })
    .onConflictDoNothing();

  // `onConflictDoNothing()` fremfor sjekk-så-sett-inn med hensikt: vitest
  // kjører testfiler parallelt som standard, så to filers `beforeAll` kunne
  // begge se "ingen eksisterende rad" og begge forsøke å sette inn samme
  // rad — nøyaktig denne racen slo til første gang dette ble kjørt (se
  // NATTLOGG.md, økt 7). Idempotent insert unngår kappløpet i stedet for å
  // late som det ikke finnes.
  for (const documentType of ["terms", "privacy", "journalist_terms"] as const) {
    await db
      .insert(legalDocuments)
      .values({
        countryCode,
        locale: "nb-NO",
        documentType,
        version: "1.0.0",
        body: `Testversjon av ${documentType} (${countryCode}).`,
        publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // publisert i går
      })
      .onConflictDoNothing();
  }
}

export function uniqueTestEmail(prefix: string): string {
  return `${prefix}-${randomUUID()}@example.invalid`;
}

/** Oppretter en aktiv, verifisert mottakerkonto direkte (uten å gå via
 * registreringsflyten) — for tester som trenger en ferdig konto som
 * forutsetning, ikke som selve testobjektet. */
export async function createActiveRecipient(): Promise<{ id: string; email: string }> {
  const email = uniqueTestEmail("recipient");
  const [user] = await db
    .insert(users)
    .values({
      email,
      role: "recipient",
      status: "active",
      countryCode: TEST_COUNTRY_CODE,
      locale: "nb-NO",
      emailVerifiedAt: new Date(),
    })
    .returning({ id: users.id });
  if (!user) throw new Error("Kunne ikke opprette test-mottaker");
  return { id: user.id, email };
}

/** Oppretter en aktiv journalistkonto MED en tilhørende, godkjent
 * JournalistProfile-rad — en journalist uten profil er ikke en gyldig
 * tilstand (19.5: én-til-én, opprettet atomisk ved søknad), og flere
 * spørringer (bl.a. `getPublicRequest()`) forutsetter en innerjoin mot
 * `journalist_profiles`. */
export async function createActiveJournalist(): Promise<{ id: string; email: string }> {
  const email = uniqueTestEmail("journalist");
  const [user] = await db
    .insert(users)
    .values({
      email,
      role: "journalist",
      status: "active",
      countryCode: TEST_COUNTRY_CODE,
      locale: "nb-NO",
      emailVerifiedAt: new Date(),
    })
    .returning({ id: users.id });
  if (!user) throw new Error("Kunne ikke opprette test-journalist");

  await db.insert(journalistProfiles).values({
    userId: user.id,
    fullName: "Test Journalist",
    jobTitle: "Journalist",
    organizationName: "Testavisen",
    organizationUrl: "https://example.invalid",
    verificationStatus: "approved",
  });

  return { id: user.id, email };
}
