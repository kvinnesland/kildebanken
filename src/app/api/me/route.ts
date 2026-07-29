import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";

// GET /me (SPEC-V1.md 20). Første beskyttede endepunkt i skjelettet — beviser
// at hele autentiseringskjeden (token → økt → cookie → oppslag) faktisk
// henger sammen. PATCH/DELETE (visningsnavn, locale, kontosletting) er ikke
// bygget ennå — se NATTLOGG.md.
export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    userId: session.userId,
    role: session.role,
    countryCode: session.countryCode,
    locale: session.locale,
  });
}
