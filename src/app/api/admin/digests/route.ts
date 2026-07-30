import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { listDigests } from "@/lib/digests/digests";

// GET /admin/digests (SPEC-V1.md 20, 16.2).
export async function GET() {
  const session = await getCurrentSession();
  if (!session || (session.role !== "moderator" && session.role !== "admin")) {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }

  const digestList = await listDigests(session);
  return NextResponse.json({ digests: digestList });
}
