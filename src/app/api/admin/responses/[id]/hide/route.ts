import { NextResponse } from "next/server";
import { hideResponse } from "@/lib/moderation/responses";

// POST /admin/responses/:id/hide (SPEC-V1.md 12.5, 20). Autorisasjon
// (moderator tildelt landet, eller administrator) håndheves inne i
// hideResponse() selv, siden den må slå opp svarets land først.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await hideResponse(id);

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
