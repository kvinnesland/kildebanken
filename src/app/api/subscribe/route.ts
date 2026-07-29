import { NextResponse } from "next/server";
import { z } from "zod";
import { registerRecipient } from "@/lib/registration/recipient";

// POST /subscribe (SPEC-V1.md 20, 7.1). Feltgrenser matcher 7.1 — ingen
// felt utover e-post, land, språk og de tre samtykkene er obligatoriske.
const bodySchema = z.object({
  email: z.string().email(),
  countryCode: z.string().length(2),
  locale: z.string().min(2),
  displayName: z.string().max(80).optional(),
  consentEmailSubscription: z.boolean(),
  consentTerms: z.boolean(),
  consentMinimumAge: z.boolean(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.generic" }, { status: 400 });
  }

  const result = await registerRecipient({
    ...parsed.data,
    email: parsed.data.email.toLowerCase().trim(),
    countryCode: parsed.data.countryCode.toUpperCase(),
  });

  if (!result.ok) {
    const status = result.error === "errors.email_already_registered" ? 409 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
