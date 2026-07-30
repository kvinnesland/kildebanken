import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { closeRequest } from "@/lib/requests/requests";

// POST /admin/requests/:id/close (SPEC-V1.md 20, 9.2, 16.2) — moderator
// (tildelt landet) eller administrator. Samme underliggende operasjon som
// POST /requests/:id/close (journalistens egen), se closeRequest() i
// src/lib/requests/requests.ts for autorisasjonsreglene.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }
  if (session.role !== "moderator" && session.role !== "admin") {
    return NextResponse.json({ error: "errors.not_authorized" }, { status: 403 });
  }

  const { id } = await params;
  const result = await closeRequest(id, session.userId);
  if (!result.ok) {
    const status =
      result.error === "errors.not_found" ? 404 : result.error === "errors.not_authorized" ? 403 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
