import { and, desc, eq, lte } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { legalDocuments, type legalDocumentType } from "@/db/schema";

type LegalDocumentType = (typeof legalDocumentType.enumValues)[number];

/**
 * Finner gjeldende publiserte versjon av et juridisk dokument for
 * (land, locale, type). "Gjeldende" = høyeste `published_at` som ikke ligger
 * i fremtiden — se SPEC-V1.md 19.2 og 17.2.
 *
 * Returnerer null hvis ingen publisert versjon finnes. Kalleren skal
 * behandle det som at locale-en IKKE er tilgjengelig i landet (FR-009) —
 * aldri anta et tomt dokument.
 */
export async function getCurrentLegalDocument(
  countryCode: string,
  locale: string,
  documentType: LegalDocumentType,
  dbase: Database = db
) {
  const [doc] = await dbase
    .select()
    .from(legalDocuments)
    .where(
      and(
        eq(legalDocuments.countryCode, countryCode),
        eq(legalDocuments.locale, locale),
        eq(legalDocuments.documentType, documentType),
        lte(legalDocuments.publishedAt, new Date())
      )
    )
    .orderBy(desc(legalDocuments.publishedAt))
    .limit(1);

  return doc ?? null;
}

/**
 * Henter alle juridiske dokumenttyper en registreringsflyt trenger, i én
 * runde. Returnerer null for HELE resultatet dersom ett eneste dokument
 * mangler — en delvis fullført samtykkeflyt er verre enn en tydelig feil.
 */
export async function getRequiredLegalDocuments(
  countryCode: string,
  locale: string,
  documentTypes: readonly LegalDocumentType[],
  dbase: Database = db
): Promise<Record<string, Awaited<ReturnType<typeof getCurrentLegalDocument>>> | null> {
  const result: Record<string, Awaited<ReturnType<typeof getCurrentLegalDocument>>> = {};

  for (const type of documentTypes) {
    const doc = await getCurrentLegalDocument(countryCode, locale, type, dbase);
    if (!doc) return null;
    result[type] = doc;
  }

  return result;
}
