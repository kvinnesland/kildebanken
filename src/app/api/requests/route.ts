import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { createDraft } from "@/lib/requests/requests";

// POST /requests (SPEC-V1.md 20, FR-010). Oppretter et tomt utkast — se
// createDraft() for hvorfor ingen felter er obligatoriske her.
export async function POST() {
  const session = await getCurrentSession();
  if (!session || session.role !== "journalist") {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }

  const result = await createDraft(session.userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ id: result.id }, { status: 201 });
}
