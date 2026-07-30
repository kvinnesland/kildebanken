import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { listMineRequests } from "@/lib/requests/requests";

// GET /requests/mine (SPEC-V1.md 20). Journalistens egne forespørsler, alle
// statuser unntatt `deleted`.
export async function GET() {
  const session = await getCurrentSession();
  if (!session || session.role !== "journalist") {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }

  const mine = await listMineRequests(session.userId);
  return NextResponse.json({ requests: mine });
}
