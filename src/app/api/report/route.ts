import { NextResponse } from "next/server";
import { z } from "zod";
import { submitReport } from "@/lib/reports/reports";

const bodySchema = z.object({
  entityType: z.enum(["request", "response"]),
  entityId: z.string().uuid(),
  reason: z.string().min(1).max(200),
  comment: z.string().max(1000).optional(),
});

// POST /report (SPEC-V1.md 12.5, 20) — ingen innlogging krevd. Ingen egen
// datamodell (25, punkt 10): sender e-post til moderatorene for det
// aktuelle landet, lagrer ingenting selv.
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.generic" }, { status: 400 });
  }

  const result = await submitReport(parsed.data);
  if (!result.ok) {
    const status = result.error === "errors.not_found" ? 404 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
