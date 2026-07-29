import { NextResponse } from "next/server";
import { revokeCurrentSession } from "@/lib/auth/session";

// POST /auth/logout (SPEC-V1.md 20). Tilbakekaller økten i databasen, ikke
// bare cookien lokalt — se begrunnelse i src/lib/auth/session.ts.
export async function POST() {
  await revokeCurrentSession();
  return NextResponse.json({ ok: true });
}
