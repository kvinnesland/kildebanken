import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import {
  deleteDraft,
  getOwnedRequestDetail,
  getPublicRequest,
  updateDraft,
} from "@/lib/requests/requests";

// GET /requests/:id (SPEC-V1.md 20, 11, 15.2). Offentlig for publiserte,
// lukkede og utløpte forespørsler — ellers bare synlig for eierens egen
// innloggede økt (draft/submitted/changes_requested/rejected).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const publicView = await getPublicRequest(id);
  if (publicView) return NextResponse.json({ request: publicView });

  const session = await getCurrentSession();
  if (session && session.role === "journalist") {
    const owned = await getOwnedRequestDetail(id, session.userId);
    if (owned) return NextResponse.json({ request: owned });
  }

  return NextResponse.json({ error: "errors.not_found" }, { status: 404 });
}

const patchSchema = z.object({
  title: z.string().max(120).optional(),
  summary: z.string().max(300).optional(),
  description: z.string().max(5000).optional(),
  targetPersonDescription: z.string().max(500).optional(),
  topic: z.string().nullable().optional(),
  geographicNote: z.string().max(100).nullable().optional(),
  internalReference: z.string().max(100).nullable().optional(),
  // Rå YYYY-MM-DDTHH:mm fra <input type="datetime-local">, tolket i
  // LANDETS tidssone av updateDraft() selv (SPEC-V1.md 9.1) — se
  // src/lib/datetime/timezone.ts.
  responseDeadlineLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).optional(),
  allowsAnonymousParticipation: z.boolean().optional(),
  mayBeRecorded: z.boolean().optional(),
  mayInvolvePhotoVideo: z.boolean().optional(),
  contentLanguage: z.string().optional(),
});

// PATCH /requests/:id — kun draft og changes_requested (SPEC-V1.md 20).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session || session.role !== "journalist") {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.generic" }, { status: 400 });
  }

  const result = await updateDraft(id, session.userId, parsed.data);
  if (!result.ok) {
    const status = result.error === "errors.not_found" ? 404 : 422;
    return NextResponse.json({ error: result.error, fieldErrors: result.fieldErrors }, { status });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /requests/:id — kun før publisering (SPEC-V1.md 20, 9.2).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session || session.role !== "journalist") {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const result = await deleteDraft(id, session.userId);
  if (!result.ok) {
    const status = result.error === "errors.not_found" ? 404 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
