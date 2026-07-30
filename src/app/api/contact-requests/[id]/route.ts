import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getContactRequestDetail } from "@/lib/contact-requests/contact-requests";

// GET /contact-requests/:id (SPEC-V1.md 20). Synlig for de to involverte
// partene — se getContactRequestDetail().
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const detail = await getContactRequestDetail(id, session.userId);
  if (!detail) return NextResponse.json({ error: "errors.not_found" }, { status: 404 });

  return NextResponse.json({ contactRequest: detail });
}
