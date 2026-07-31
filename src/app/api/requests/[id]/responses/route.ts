import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { submitResponse } from "@/lib/responses/responses";

const bodySchema = z.object({
  relevanceStatement: z.string().max(2000),
  answerText: z.string().max(4000),
  shortBio: z.string().max(500).nullable().optional(),
  displayName: z.string().max(80).nullable().optional(),
  contactSharing: z.enum(["none", "email"]).default("none"),
});

// POST /requests/:id/responses (SPEC-V1.md 20, 12). Krever verifisert
// mottakerkonto (FR-002/FR-030).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session || session.role !== "recipient") {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.generic" }, { status: 400 });
  }

  const result = await submitResponse(id, session.userId, parsed.data);
  if (!result.ok) {
    const status =
      result.error === "errors.not_found"
        ? 404
        : result.error === "errors.already_responded"
          ? 409
          : result.error === "errors.rate_limited"
            ? 429
            : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ id: result.id }, { status: 201 });
}
