import { NextResponse } from "next/server";
import { approveJournalist } from "@/lib/moderation/journalists";

// POST /admin/journalists/:id/approve (SPEC-V1.md 20, 8). Autorisasjon
// (moderator tildelt landet, eller administrator) håndheves inne i
// approveJournalist() selv, siden den må slå opp journalistens land før den
// vet HVILKEN moderatortildeling som er relevant.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await approveJournalist(id);

  if (!result.ok) {
    const status =
      result.error === "errors.not_found"
        ? 404
        : result.error === "errors.not_authorized"
          ? 403
          : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
