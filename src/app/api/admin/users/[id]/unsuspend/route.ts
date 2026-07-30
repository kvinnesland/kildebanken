import { NextResponse } from "next/server";
import { unsuspendUser } from "@/lib/moderation/users";

// POST /admin/users/:id/unsuspend (SPEC-V1.md 20, 8.1, 16.2 — lagt til under
// autonomt arbeid, se merknad i seksjon 20 og NATTLOGG.md).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await unsuspendUser(id);
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
