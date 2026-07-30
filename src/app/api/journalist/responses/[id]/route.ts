import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getResponseDetailForJournalist } from "@/lib/journalist-inbox/journalist-inbox";

// GET /journalist/responses/:id (SPEC-V1.md 20, 13). Setter viewed_at ved
// første åpning — se journalist-inbox.ts.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session || session.role !== "journalist") {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const result = await getResponseDetailForJournalist(id, session.userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });

  return NextResponse.json({ response: result.data });
}
