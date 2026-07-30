import { NextResponse } from "next/server";
import { retryFailedDigestDeliveries } from "@/lib/digests/digests";

// POST /admin/digests/:id/retry (SPEC-V1.md 20, 16.2: "kjør på nytt ved
// feil"). Autorisasjon (moderator tildelt landet, eller administrator)
// håndheves inne i retryFailedDigestDeliveries().
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await retryFailedDigestDeliveries(id);
  if (!result.ok) {
    const status =
      result.error === "errors.not_found" ? 404 : result.error === "errors.not_authorized" ? 403 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, retried: result.retried });
}
