import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { withdrawResponse } from "@/lib/responses/responses";

// POST /responses/:id/withdraw (SPEC-V1.md 20, FR-033, 12.4/17.4). Svaret
// slettes umiddelbart — se withdrawResponse().
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session || session.role !== "recipient") {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const result = await withdrawResponse(id, session.userId);
  if (!result.ok) {
    const status = result.error === "errors.not_found" ? 404 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
