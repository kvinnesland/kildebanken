import { NextResponse } from "next/server";
import { getCurrentLegalDocument } from "@/lib/legal/documents";
import { legalDocumentType } from "@/db/schema";

// GET /legal/:country/:locale/:type — gjeldende publiserte versjon av et
// juridisk dokument (SPEC-V1.md 20, 19.2). Offentlig, ingen innlogging —
// vilkår og personvernerklæring må kunne leses før registrering.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ country: string; locale: string; type: string }> }
) {
  const { country, locale, type } = await params;

  if (!legalDocumentType.enumValues.includes(type as (typeof legalDocumentType.enumValues)[number])) {
    return NextResponse.json({ error: "errors.not_found" }, { status: 404 });
  }

  const document = await getCurrentLegalDocument(
    country.toUpperCase(),
    locale,
    type as (typeof legalDocumentType.enumValues)[number]
  );
  if (!document) {
    return NextResponse.json({ error: "errors.not_found" }, { status: 404 });
  }

  return NextResponse.json({
    document: {
      documentType: document.documentType,
      version: document.version,
      body: document.body,
      publishedAt: document.publishedAt,
    },
  });
}
