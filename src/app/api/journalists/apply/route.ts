import { NextResponse } from "next/server";
import { z } from "zod";
import { applyAsJournalist } from "@/lib/registration/journalist";

// POST /journalists/apply (SPEC-V1.md 20, 7.2).
const bodySchema = z.object({
  fullName: z.string().min(1).max(200),
  jobEmail: z.string().email(),
  jobTitle: z.string().min(1).max(200),
  organizationName: z.string().min(1).max(200),
  organizationUrl: z.string().url(),
  countryCode: z.string().length(2),
  locale: z.string().min(2),
  consentJournalistTerms: z.boolean(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.generic" }, { status: 400 });
  }

  const result = await applyAsJournalist({
    ...parsed.data,
    jobEmail: parsed.data.jobEmail.toLowerCase().trim(),
    countryCode: parsed.data.countryCode.toUpperCase(),
  });

  if (!result.ok) {
    const status = result.error === "errors.email_already_registered" ? 409 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
