import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { respondToContactRequest } from "@/lib/contact-requests/contact-requests";

// POST /contact-requests/:id/decline (SPEC-V1.md 20, 14.2 — "avslag
// varsles journalisten uten begrunnelse", derfor ingen body her).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session || session.role !== "recipient") {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const result = await respondToContactRequest(id, session.userId, "declined");
  if (!result.ok) {
    const status = result.error === "errors.not_found" ? 404 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
