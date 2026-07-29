import { NextResponse } from "next/server";
import { z } from "zod";
import { requestMagicLink } from "@/lib/auth/magic-link";

const bodySchema = z.object({ email: z.string().email() });

// POST /auth/request-link (SPEC-V1.md 20). Returnerer ALLTID samme svar,
// uansett om e-posten finnes, er suspendert, eller har nådd rategrensen —
// se begrunnelse i src/lib/auth/magic-link.ts.
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.invalid_email" }, { status: 400 });
  }

  await requestMagicLink(parsed.data.email.toLowerCase().trim());

  return NextResponse.json({ ok: true });
}
