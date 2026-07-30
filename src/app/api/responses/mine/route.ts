import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { listMineResponses } from "@/lib/responses/responses";

// GET /responses/mine (SPEC-V1.md 20).
export async function GET() {
  const session = await getCurrentSession();
  if (!session || session.role !== "recipient") {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }

  const mine = await listMineResponses(session.userId);
  return NextResponse.json({ responses: mine });
}
