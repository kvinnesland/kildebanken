import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { updateMyProfile } from "@/lib/me/profile";

// GET /me (SPEC-V1.md 20). Beviser at hele autentiseringskjeden (token →
// økt → cookie → oppslag) faktisk henger sammen. DELETE /me er bygget som
// en egen to-stegs flyt (POST /me/request-deletion + /me/confirm-deletion,
// se NATTLOGG.md økt 7) i stedet for én direkte DELETE-rute, nettopp fordi
// 24.3 krever ny autentisering for sensitive handlinger — et rent
// DELETE-kall fra en allerede innlogget klient kunne ikke tvinge det frem.
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

const patchSchema = z.object({
  displayName: z.string().max(200).nullable().optional(),
  locale: z.string().min(2).optional(),
  timezone: z.string().nullable().optional(),
});

// PATCH /me — visningsnavn, locale, timezone (SPEC-V1.md 20). Bytte av LAND
// går via en egen rute (POST /me/change-country) fordi det krever fornyet
// samtykke (FR-010) — noe et generisk PATCH-endepunkt ikke skal kunne
// omgå ved et uhell.
export async function PATCH(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.generic" }, { status: 400 });
  }

  const result = await updateMyProfile(session.userId, parsed.data);
  if (!result.ok) {
    const status = result.error === "errors.not_found" ? 404 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
