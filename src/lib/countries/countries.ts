import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { countries, type legalDocumentType } from "@/db/schema";
import { getRequiredLegalDocuments } from "@/lib/legal/documents";

type LegalDocumentType = (typeof legalDocumentType.enumValues)[number];

export interface ActiveCountryOption {
  code: string;
  nameKey: string;
  defaultLocale: string;
  availableLocales: string[];
  minimumAge: number;
}

/**
 * GET /countries (SPEC-V1.md 20). Kun `active` land — et land i `draft` er
 * usynlig for alle utenom administrator (3.3).
 *
 * FR-009: "Systemet skal ikke tilby en locale i et land der vilkår eller
 * personvernerklæring mangler i den locale-en." Manglet fullstendig frem
 * til nå — `available_locales` ble returnert rått, uten å sjekke om
 * dokumentene faktisk fantes (se NATTLOGG.md, økt 7). `requiredDocumentTypes`
 * er bevisst VALGFRI og tom som standard: enkelte forbrukere av denne ruten
 * (f.eks. journalistens språkvalg for selve FORESPØRSELSINNHOLDET, som ikke
 * er en registreringskontekst) trenger ingen slik filtrering i det hele
 * tatt, og skal fortsette å se alle konfigurerte locales uendret.
 */
export async function listActiveCountries(
  requiredDocumentTypes: readonly LegalDocumentType[] = []
): Promise<ActiveCountryOption[]> {
  const activeCountries = await db
    .select({
      code: countries.code,
      nameKey: countries.nameKey,
      defaultLocale: countries.defaultLocale,
      availableLocales: countries.availableLocales,
      minimumAge: countries.minimumAge,
    })
    .from(countries)
    .where(eq(countries.status, "active"));

  if (requiredDocumentTypes.length === 0) {
    return activeCountries;
  }

  return Promise.all(
    activeCountries.map(async (country) => ({
      ...country,
      availableLocales: await filterLocalesWithRequiredDocuments(
        country.code,
        country.availableLocales,
        requiredDocumentTypes
      ),
    }))
  );
}

async function filterLocalesWithRequiredDocuments(
  countryCode: string,
  locales: readonly string[],
  requiredDocumentTypes: readonly LegalDocumentType[]
): Promise<string[]> {
  const results = await Promise.all(
    locales.map(async (locale) => {
      const docs = await getRequiredLegalDocuments(countryCode, locale, requiredDocumentTypes);
      return docs ? locale : null;
    })
  );
  return results.filter((locale): locale is string => locale !== null);
}
