import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { updateResponseMarking } from "@/lib/journalist-inbox/journalist-inbox";

const bodySchema = z.object({
  marking: z.enum(["unreviewed", "shortlisted", "not_selected"]).optional(),
  note: z.string().max(4000).nullable().optional(),
});

// PATCH /journalist/responses/:id/status (SPEC-V1.md 20, 13.1). Setter
// journalistens markering og/eller interne notat — aldri synlig for
// respondenten.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session || session.role !== "journalist") {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.generic" }, { status: 400 });
  }

  const result = await updateResponseMarking(id, session.userId, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });

  return NextResponse.json({ ok: true });
}
