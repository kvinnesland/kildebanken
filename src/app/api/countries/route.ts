import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { countries } from "@/db/schema";

// GET /countries (SPEC-V1.md 20). Kun `active` land — et land i `draft` er
// usynlig for alle utenom administrator (3.3), og skal derfor aldri kunne
// velges i registreringsskjemaet.
export async function GET() {
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

  return NextResponse.json({ countries: activeCountries });
}
