import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { countries, legalDocuments } from "@/db/schema";
import { listActiveCountries } from "./countries";

// Eget, isolert testland (samme mønster som dashboard.integration.test.ts,
// økt 7) — unngår enhver avhengighet av TEST_COUNTRY_CODE sin delte,
// akkumulerte tilstand fra andre testfiler.
async function createIsolatedCountry(availableLocales: string[]): Promise<string> {
  const code = `Z${randomUUID().slice(0, 6).toUpperCase()}`;
  await db.insert(countries).values({
    code,
    nameKey: "country.test.name",
    defaultLocale: availableLocales[0]!,
    availableLocales,
    timezone: "Europe/Oslo",
    minimumAge: 18,
    digestSendTime: "07:00",
    senderNameKey: "email.sender_name.test",
    supportEmail: "test@example.invalid",
    status: "active",
  });
  return code;
}

async function publishDocument(
  countryCode: string,
  locale: string,
  documentType: "terms" | "privacy" | "journalist_terms"
): Promise<void> {
  await db.insert(legalDocuments).values({
    countryCode,
    locale,
    documentType,
    version: `test-${randomUUID()}`,
    body: "Testtekst.",
    publishedAt: new Date(Date.now() - 60 * 1000),
  });
}

async function cleanupCountry(code: string): Promise<void> {
  await db.delete(legalDocuments).where(eq(legalDocuments.countryCode, code));
  await db.delete(countries).where(eq(countries.code, code));
}

describe("listActiveCountries mot ekte Postgres (SPEC-V1.md 20, FR-009)", () => {
  it("uten requiredDocumentTypes: returnerer available_locales UFILTRERT", async () => {
    const code = await createIsolatedCountry(["nb-NO", "en-GB"]);
    try {
      // Ingen dokumenter publisert i det hele tatt for dette landet.
      const result = await listActiveCountries();

      const country = result.find((c) => c.code === code);
      expect(country?.availableLocales).toEqual(["nb-NO", "en-GB"]);
    } finally {
      await cleanupCountry(code);
    }
  });

  it("med requiredDocumentTypes: fjerner en locale der ETT av dokumentene mangler", async () => {
    const code = await createIsolatedCountry(["nb-NO", "en-GB"]);
    try {
      await publishDocument(code, "nb-NO", "terms");
      await publishDocument(code, "nb-NO", "privacy");
      await publishDocument(code, "en-GB", "terms");
      // en-GB mangler "privacy" — skal derfor filtreres bort.

      const result = await listActiveCountries(["terms", "privacy"]);

      const country = result.find((c) => c.code === code);
      expect(country?.availableLocales).toEqual(["nb-NO"]);
    } finally {
      await cleanupCountry(code);
    }
  });

  it("beholder en locale kun hvis ALLE forespurte dokumenttyper finnes", async () => {
    const code = await createIsolatedCountry(["nb-NO"]);
    try {
      await publishDocument(code, "nb-NO", "terms");
      await publishDocument(code, "nb-NO", "privacy");
      await publishDocument(code, "nb-NO", "journalist_terms");

      const result = await listActiveCountries(["terms", "privacy", "journalist_terms"]);

      const country = result.find((c) => c.code === code);
      expect(country?.availableLocales).toEqual(["nb-NO"]);
    } finally {
      await cleanupCountry(code);
    }
  });

  it("filtrerer bort ALLE locales når landet ikke har noen av de forespurte dokumentene", async () => {
    const code = await createIsolatedCountry(["nb-NO", "en-GB"]);
    try {
      const result = await listActiveCountries(["journalist_terms"]);

      const country = result.find((c) => c.code === code);
      expect(country?.availableLocales).toEqual([]);
    } finally {
      await cleanupCountry(code);
    }
  });

  it("returnerer ikke land som ikke er active", async () => {
    const code = await createIsolatedCountry(["nb-NO"]);
    await db.update(countries).set({ status: "draft" }).where(eq(countries.code, code));
    try {
      const result = await listActiveCountries();

      expect(result.some((c) => c.code === code)).toBe(false);
    } finally {
      await cleanupCountry(code);
    }
  });
});
