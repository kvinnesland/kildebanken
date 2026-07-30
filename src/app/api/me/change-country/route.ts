import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { changeCountry } from "@/lib/me/change-country";

const bodySchema = z.object({
  countryCode: z.string().length(2),
  locale: z.string().min(2),
  consentTerms: z.boolean(),
});

// POST /me/change-country (SPEC-V1.md 7.3, 20, FR-010). Kun mottakere — en
// journalist kan ikke bytte land selv (7.3, siste avsnitt: krever ny
// moderatorvurdering knyttet til markedet).
export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "errors.not_authenticated" }, { status: 401 });
  }
  if (session.role !== "recipient") {
    return NextResponse.json({ error: "errors.not_authorized" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.generic" }, { status: 400 });
  }

  const result = await changeCountry(session.userId, {
    ...parsed.data,
    countryCode: parsed.data.countryCode.toUpperCase(),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ ok: true });
}
