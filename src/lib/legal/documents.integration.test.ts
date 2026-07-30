import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { legalDocuments } from "@/db/schema";
import { ensureTestCountry, TEST_COUNTRY_CODE } from "@/db/integration/fixtures";
import { getCurrentLegalDocument, getRequiredLegalDocuments } from "./documents";

// Ingen next/headers-/økt-avhengighet — rene spørringer mot legal_documents,
// ingen mocking nødvendig.

function uniqueVersion(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

describe("getCurrentLegalDocument mot ekte Postgres (SPEC-V1.md 17.2/19.2)", () => {
  it("returnerer null for en locale/type-kombinasjon som ikke finnes i landet", async () => {
    await ensureTestCountry();

    const result = await getCurrentLegalDocument(TEST_COUNTRY_CODE, "fr-FR", "terms");

    expect(result).toBeNull();
  });

  it("returnerer den NYESTE publiserte versjonen, ikke en eldre", async () => {
    // Bruker "privacy", IKKE "terms" — admin/legal-documents.integration.test.ts
    // kjører parallelt og publiserer stadig nye "terms"-versjoner for samme
    // (TEST_COUNTRY_CODE, nb-NO), noe som ville gjort en eksakt
    // versjonssammenligning der skjør. "privacy" er urørt av den filen.
    await ensureTestCountry();
    const olderVersion = uniqueVersion("older");
    const newerVersion = uniqueVersion("newer");
    await db.insert(legalDocuments).values([
      {
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        documentType: "privacy",
        version: olderVersion,
        body: "Eldre versjon.",
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        documentType: "privacy",
        version: newerVersion,
        body: "Nyere versjon.",
        publishedAt: new Date(Date.now() - 30 * 1000),
      },
    ]);

    const result = await getCurrentLegalDocument(TEST_COUNTRY_CODE, "nb-NO", "privacy");

    expect(result?.version).toBe(newerVersion);
  });

  it("ignorerer versjoner publisert i FREMTIDEN, selv om de er nyeste rad", async () => {
    // "en-GB" i stedet for "nb-NO" — isolerer denne testen fullstendig fra
    // forrige test sine rader (samme (land, type)-par ville ellers gjort
    // "nyeste ikke-fremtidige rad" avhengig av kjørerekkefølgen mellom dem).
    await ensureTestCountry();
    const currentVersion = uniqueVersion("current");
    const futureVersion = uniqueVersion("future");
    await db.insert(legalDocuments).values([
      {
        countryCode: TEST_COUNTRY_CODE,
        locale: "en-GB",
        documentType: "privacy",
        version: currentVersion,
        body: "Gjeldende versjon.",
        publishedAt: new Date(Date.now() - 60 * 1000),
      },
      {
        countryCode: TEST_COUNTRY_CODE,
        locale: "en-GB",
        documentType: "privacy",
        version: futureVersion,
        body: "Fremtidig versjon, ikke publisert ennå.",
        publishedAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    ]);

    const result = await getCurrentLegalDocument(TEST_COUNTRY_CODE, "en-GB", "privacy");

    expect(result?.version).toBe(currentVersion);
  });
});

describe("getRequiredLegalDocuments mot ekte Postgres", () => {
  it("returnerer alle forespurte dokumenttyper i ett resultat", async () => {
    await ensureTestCountry();

    const result = await getRequiredLegalDocuments(TEST_COUNTRY_CODE, "nb-NO", ["terms", "privacy"]);

    expect(result).not.toBeNull();
    expect(result?.terms).not.toBeNull();
    expect(result?.privacy).not.toBeNull();
  });

  it("returnerer null for HELE resultatet dersom ÉN type mangler — ingen delvis samtykkeflyt", async () => {
    await ensureTestCountry();

    const result = await getRequiredLegalDocuments(TEST_COUNTRY_CODE, "fr-FR", ["terms", "privacy"]);

    expect(result).toBeNull();
  });
});
