import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { closeRequest } from "@/lib/requests/requests";

// POST /requests/:id/close (SPEC-V1.md 20, 9.2). Journalist (eier) eller
// moderator/administrator — se closeRequest().
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
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
