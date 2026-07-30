import { NextResponse } from "next/server";
import { publishRequest } from "@/lib/moderation/requests";

function statusFor(error: string): number {
  if (error === "errors.not_found") return 404;
  if (error === "errors.not_authorized") return 403;
  return 422;
}

// POST /admin/requests/:id/publish (SPEC-V1.md 20, 9.2).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await publishRequest(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: statusFor(result.error) });
  return NextResponse.json({ ok: true });
}
