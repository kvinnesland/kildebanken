import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { getJournalistProfile, updateJournalistProfile } from "@/lib/journalists/journalist-profile";

// GET /journalists/me (SPEC-V1.md 20).
export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }
  if (session.role !== "journalist") {
    return NextResponse.json({ error: "errors.not_authorized" }, { status: 403 });
  }

  const profile = await getJournalistProfile(session.userId);
  if (!profile) {
    return NextResponse.json({ error: "errors.not_found" }, { status: 404 });
  }

  return NextResponse.json({ profile });
}

const patchSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  jobTitle: z.string().min(1).max(200).optional(),
  organizationName: z.string().min(1).max(200).optional(),
  organizationUrl: z.string().url().optional(),
});

// PATCH /journalists/me (SPEC-V1.md 20, 7.2). Rører aldri country_code eller
// verification_status — se begrunnelse i
// src/lib/journalists/journalist-profile.ts.
export async function PATCH(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }
  if (session.role !== "journalist") {
    return NextResponse.json({ error: "errors.not_authorized" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.generic" }, { status: 400 });
  }

  const result = await updateJournalistProfile(session.userId, parsed.data);
  if (!result.ok) {
    const status = result.error === "errors.not_found" ? 404 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
