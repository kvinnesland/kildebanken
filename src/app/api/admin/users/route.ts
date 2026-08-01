import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { searchUsersByEmail } from "@/lib/moderation/users";

// GET /admin/users?email=... (SPEC-V1.md 20, 16.2: "søk på e-postadresse").
export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "moderator" && session.role !== "admin")) {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email") ?? "";

  const users = await searchUsersByEmail(session, email);
  return NextResponse.json({ users });
}
