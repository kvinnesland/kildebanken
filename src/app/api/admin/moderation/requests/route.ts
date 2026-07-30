import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { listModerationQueue } from "@/lib/moderation/requests";

// GET /admin/moderation/requests (SPEC-V1.md 20, 21.4).
export async function GET() {
  const session = await getCurrentSession();
  if (!session || (session.role !== "moderator" && session.role !== "admin")) {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }

  const queue = await listModerationQueue(session);
  return NextResponse.json({ requests: queue });
}
