import { NextResponse } from "next/server";
import { z } from "zod";
import { rejectJournalist } from "@/lib/moderation/journalists";

const bodySchema = z.object({ reason: z.string().min(1).max(2000) });

// POST /admin/journalists/:id/reject (SPEC-V1.md 20, 8). Begrunnelse er
// obligatorisk — se rejectJournalist() i src/lib/moderation/journalists.ts.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.reason_required" }, { status: 400 });
  }

  const result = await rejectJournalist(id, parsed.data.reason);

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
