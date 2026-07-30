import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { listJournalists } from "@/lib/moderation/journalists";

const STATUS_VALUES = ["pending_review", "approved", "rejected"] as const;

// GET /admin/journalists (SPEC-V1.md 20). Filtrert på moderatorens tildelte
// land — se src/lib/moderation/journalists.ts.
export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "moderator" && session.role !== "admin")) {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }

  const statusParam = new URL(request.url).searchParams.get("status");
  const statusFilter = (STATUS_VALUES as readonly string[]).includes(statusParam ?? "")
    ? (statusParam as (typeof STATUS_VALUES)[number])
    : undefined;

  const journalists = await listJournalists(session, statusFilter);
  return NextResponse.json({ journalists });
}
