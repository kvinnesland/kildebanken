import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyMagicLink } from "@/lib/auth/magic-link";
import { createSession } from "@/lib/auth/session";

const bodySchema = z.object({ token: z.string().min(1) });

// POST /auth/verify (SPEC-V1.md 20). Ett bruk, deretter ugyldig — se
// auth.verify.already_used / auth.verify.expired i i18n-meldingene.
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.generic" }, { status: 400 });
  }

  const verified = await verifyMagicLink(parsed.data.token);
  if (!verified) {
    return NextResponse.json({ error: "auth.verify.expired" }, { status: 401 });
  }

  const { expiresAt } = await createSession(verified.userId, verified.role);

  return NextResponse.json({ ok: true, expiresAt });
}
