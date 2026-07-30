import { NextResponse } from "next/server";
import {
  ADMIN_RESPONSE_ACCESS_REASONS,
  getResponseForAdmin,
  type AdminResponseAccessReason,
} from "@/lib/admin/responses";

function isValidReason(value: string | null): value is AdminResponseAccessReason {
  return value !== null && (ADMIN_RESPONSE_ACCESS_REASONS as readonly string[]).includes(value);
}

// GET /admin/responses/:id?reason=... (SPEC-V1.md 16.2, 20, FR-051) — kun
// administrator, begrunnelse obligatorisk fra en lukket liste (ikke
// fritekst), se getResponseForAdmin().
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reason = new URL(request.url).searchParams.get("reason");

  if (!isValidReason(reason)) {
    return NextResponse.json({ error: "errors.reason_required" }, { status: 422 });
  }

  const result = await getResponseForAdmin(id, reason);
  if (!result.ok) {
    const status =
      result.error === "errors.not_authorized" ? 403 : result.error === "errors.not_found" ? 404 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ response: result.response });
}
