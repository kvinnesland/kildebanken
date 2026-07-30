import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/subscriptions/unsubscribe";

// POST /unsubscribe/:token (SPEC-V1.md 20) — uten innlogging, ett klikk.
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const result = await unsubscribeByToken(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
