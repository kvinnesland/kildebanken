import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmAccountDeletion } from "@/lib/auth/account-deletion";

const bodySchema = z.object({ token: z.string().min(1) });

// POST /me/confirm-deletion (SPEC-V1.md 17.5, 18.2 — steg 2 av 2). Krever
// IKKE en aktiv økt — tokenet alene er autoriteten her, samme prinsipp som
// magic link-verifisering (src/lib/auth/magic-link.ts): å ha mottatt
// e-posten ER beviset, uavhengig av om brukeren fortsatt er innlogget i
// nettleseren som ba om slettingen.
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.generic" }, { status: 400 });
  }

  const result = await confirmAccountDeletion(parsed.data.token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
