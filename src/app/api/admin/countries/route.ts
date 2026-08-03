import { NextResponse } from "next/server";
import { z } from "zod";
import { createCountry, listAllCountries } from "@/lib/admin/countries";

function statusFor(error: string): number {
  if (error === "errors.not_authorized") return 403;
  if (error === "errors.already_exists") return 409;
  return 422;
}

// GET /admin/countries (SPEC-V1.md 16.2, 20, 3.3) — kun administrator.
export async function GET() {
  const result = await listAllCountries();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: statusFor(result.error) });
  return NextResponse.json({ countries: result.countries });
}

const bodySchema = z.object({
  code: z.string().length(2),
  nameKey: z.string().min(1),
  defaultLocale: z.string().min(2),
  availableLocales: z.array(z.string().min(2)).min(1),
  timezone: z.string().min(1),
  minimumAge: z.number().int().min(0).max(100),
  digestSendTime: z.string().regex(/^\d{2}:\d{2}$/),
  senderNameKey: z.string().min(1),
  supportEmail: z.string().email(),
  maxConcurrentPublishedRequests: z.number().int().min(1).optional(),
});

// POST /admin/countries (3.3) — opprettes alltid i status "draft".
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.generic" }, { status: 400 });
  }

  const result = await createCountry({
    ...parsed.data,
    code: parsed.data.code.toUpperCase(),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: statusFor(result.error) });
  return NextResponse.json({ ok: true });
}
