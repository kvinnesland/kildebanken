import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { requestAccountDeletion } from "@/lib/auth/account-deletion";

// POST /me/request-deletion (SPEC-V1.md 17.5, 18.2 — steg 1 av 2). Krever
// aktiv økt. Sender en egen bekreftelseslenke; selve slettingen skjer først
// ved POST /me/confirm-deletion.
export async function POST() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }

  await requestAccountDeletion(session.userId);

  return NextResponse.json({ ok: true });
}
