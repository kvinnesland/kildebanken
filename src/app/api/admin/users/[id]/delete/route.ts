import { NextResponse } from "next/server";
import { adminDeleteUser } from "@/lib/moderation/users";

// POST /admin/users/:id/delete (SPEC-V1.md 20, 16.2 — lagt til under
// autonomt arbeid, se merknad i seksjon 20 og NATTLOGG.md). Ingen
// bekreftelseslenke, til forskjell fra /me/request-deletion — se
// adminDeleteUser() i src/lib/moderation/users.ts for begrunnelsen.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await adminDeleteUser(id);
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
