import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { createContactRequest } from "@/lib/contact-requests/contact-requests";

const bodySchema = z.object({
  message: z.string().min(1).max(1000),
  requestedContactMethod: z.string().min(1),
});

// POST /journalist/responses/:id/contact-request (SPEC-V1.md 20, FR-040, 14.1).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session || session.role !== "journalist") {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.generic" }, { status: 400 });
  }

  const result = await createContactRequest(id, session.userId, parsed.data);
  if (!result.ok) {
    const status =
      result.error === "errors.not_found"
        ? 404
        : result.error === "errors.not_authorized"
          ? 403
          : result.error === "errors.contact_request_already_sent"
            ? 409
            : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ id: result.id }, { status: 201 });
}
