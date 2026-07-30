import { NextResponse } from "next/server";
import { z } from "zod";
import { assignModeratorToCountry } from "@/lib/admin/countries";

const bodySchema = z.object({ email: z.string().email() });

// POST /admin/countries/:code/moderators (SPEC-V1.md 16.2, 20) — kun
// administrator. Se assignModeratorToCountry() for antagelsen om hvordan en
// moderatorkonto oppstår.
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.generic" }, { status: 400 });
  }

  const result = await assignModeratorToCountry(code.toUpperCase(), parsed.data.email.toLowerCase().trim());
  if (!result.ok) {
    const status =
      result.error === "errors.not_authorized"
        ? 403
        : result.error === "errors.not_found"
          ? 404
          : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
