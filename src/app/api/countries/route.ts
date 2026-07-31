import { NextResponse } from "next/server";
import { legalDocumentType } from "@/db/schema";
import { listActiveCountries } from "@/lib/countries/countries";

type LegalDocumentType = (typeof legalDocumentType.enumValues)[number];

function isLegalDocumentType(value: string): value is LegalDocumentType {
  return (legalDocumentType.enumValues as readonly string[]).includes(value);
}

// GET /countries?requireDocumentTypes=terms,privacy (SPEC-V1.md 20, FR-009).
// Parameteren er valgfri — se listActiveCountries() for hvorfor filtrering
// ikke skal gjelde alle forbrukere av denne ruten.
export async function GET(request: Request) {
  const rawParam = new URL(request.url).searchParams.get("requireDocumentTypes");
  const requiredDocumentTypes = rawParam
    ? rawParam.split(",").filter(isLegalDocumentType)
    : [];

  const activeCountries = await listActiveCountries(requiredDocumentTypes);

  return NextResponse.json({ countries: activeCountries });
}
