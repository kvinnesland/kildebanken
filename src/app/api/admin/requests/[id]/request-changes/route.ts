import { NextResponse } from "next/server";
import { z } from "zod";
import { requestChanges } from "@/lib/moderation/requests";

const bodySchema = z.object({ comment: z.string().min(1).max(2000) });

function statusFor(error: string): number {
  if (error === "errors.not_found") return 404;
  if (error === "errors.not_authorized") return 403;
  return 422;
}

// POST /admin/requests/:id/request-changes (SPEC-V1.md 20, 9.2). Kommentar
// obligatorisk.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.reason_required" }, { status: 400 });
  }

  const result = await requestChanges(id, parsed.data.comment);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: statusFor(result.error) });
  return NextResponse.json({ ok: true });
}
