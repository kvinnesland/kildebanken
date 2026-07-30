import { NextResponse } from "next/server";
import { z } from "zod";
import { publishLegalDocument } from "@/lib/admin/legal-documents";
import { legalDocumentType } from "@/db/schema";

const bodySchema = z.object({
  countryCode: z.string().length(2),
  locale: z.string().min(2),
  documentType: z.enum(legalDocumentType.enumValues),
  version: z.string().min(1).max(50),
  body: z.string().min(1),
  isMaterialChange: z.boolean(),
});

// POST /admin/legal-documents (SPEC-V1.md 16.2, 17.2, 20) — kun
// administrator. Publiserer alltid en NY versjon, se
// publishLegalDocument().
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.generic" }, { status: 400 });
  }

  const result = await publishLegalDocument({
    ...parsed.data,
    countryCode: parsed.data.countryCode.toUpperCase(),
  });
  if (!result.ok) {
    const status =
      result.error === "errors.not_authorized"
        ? 403
        : result.error === "errors.invalid_country"
          ? 404
          : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
