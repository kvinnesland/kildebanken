import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { submitRequest } from "@/lib/requests/requests";

// POST /requests/:id/submit (SPEC-V1.md 20, FR-011/FR-021/FR-029).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session || session.role !== "journalist") {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const result = await submitRequest(id, session.userId);
  if (!result.ok) {
    const status = result.error === "errors.not_found" ? 404 : 422;
    return NextResponse.json({ error: result.error, fieldErrors: result.fieldErrors }, { status });
  }

  return NextResponse.json({ ok: true });
}
