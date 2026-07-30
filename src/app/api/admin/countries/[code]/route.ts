import { NextResponse } from "next/server";
import { z } from "zod";
import { setCountryStatus, updateCountry } from "@/lib/admin/countries";

function statusFor(error: string): number {
  if (error === "errors.not_authorized") return 403;
  if (error === "errors.not_found") return 404;
  return 422;
}

const bodySchema = z.object({
  nameKey: z.string().min(1).optional(),
  defaultLocale: z.string().min(2).optional(),
  availableLocales: z.array(z.string().min(2)).min(1).optional(),
  timezone: z.string().min(1).optional(),
  minimumAge: z.number().int().min(0).max(100).optional(),
  digestSendTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  senderNameKey: z.string().min(1).optional(),
  supportEmail: z.string().email().optional(),
  status: z.enum(["draft", "active", "paused"]).optional(),
});

// PATCH /admin/countries/:code (SPEC-V1.md 16.2, 20, 3.3) — kun
// administrator. Feltendringer og statusbytte er ÉN rute i spec-en, men to
// separate biblioteksfunksjoner internt (`updateCountry()` /
// `setCountryStatus()`) — statusbytte har egne forutsetninger (aktivering
// krever publiserte vilkår/personvern i hvert språk og minst én tildelt
// moderator) som ikke skal kunne omgås ved samtidig å sende andre felt.
export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.generic" }, { status: 400 });
  }

  const { status, ...fields } = parsed.data;
  const countryCode = code.toUpperCase();

  if (Object.keys(fields).length > 0) {
    const fieldResult = await updateCountry(countryCode, fields);
    if (!fieldResult.ok) {
      return NextResponse.json({ error: fieldResult.error }, { status: statusFor(fieldResult.error) });
    }
  }

  if (status) {
    const statusResult = await setCountryStatus(countryCode, status);
    if (!statusResult.ok) {
      return NextResponse.json({ error: statusResult.error }, { status: statusFor(statusResult.error) });
    }
  }

  return NextResponse.json({ ok: true });
}
