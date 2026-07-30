import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { moderatorCountries, requests, responses, users } from "@/db/schema";
import { sendTransactionalEmail } from "@/lib/email/send";

export type ReportEntityType = "request" | "response";

export interface SubmitReportInput {
  entityType: ReportEntityType;
  entityId: string;
  reason: string;
  comment?: string;
}

export type SubmitReportResult = { ok: true } | { ok: false; error: string };

const REASON_MAX_LENGTH = 200;
const COMMENT_MAX_LENGTH = 1000;

/**
 * POST /report (SPEC-V1.md 12.5, 20). "Ingen egen datamodell i v1" (25,
 * punkt 10) — sender e-post til moderatorene for det landet forespørselen
 * eller svaret tilhører, i stedet for å lagre noe. Moderator vurderer og
 * handler manuelt (lukke, skjule, suspendere, sperre), og logger selve
 * TILTAKET til revisjonsloggen — ikke denne funksjonen, som bare varsler.
 */
export async function submitReport(input: SubmitReportInput): Promise<SubmitReportResult> {
  if (!input.reason.trim() || input.reason.length > REASON_MAX_LENGTH) {
    return { ok: false, error: "errors.validation_failed" };
  }
  if (input.comment !== undefined && input.comment.length > COMMENT_MAX_LENGTH) {
    return { ok: false, error: "errors.validation_failed" };
  }

  const countryCode = await findEntityCountry(input.entityType, input.entityId);
  if (!countryCode) return { ok: false, error: "errors.not_found" };

  const moderators = await db
    .select({ email: users.email, locale: users.locale })
    .from(moderatorCountries)
    .innerJoin(users, eq(moderatorCountries.moderatorUserId, users.id))
    .where(eq(moderatorCountries.countryCode, countryCode));

  for (const moderator of moderators) {
    await sendTransactionalEmail({
      template: "content_reported",
      to: { email: moderator.email, locale: moderator.locale },
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        reason: input.reason,
        comment: input.comment ?? "",
      },
    });
  }

  return { ok: true };
}

async function findEntityCountry(
  entityType: ReportEntityType,
  entityId: string
): Promise<string | null> {
  if (entityType === "request") {
    const [row] = await db
      .select({ countryCode: requests.countryCode })
      .from(requests)
      .where(eq(requests.id, entityId))
      .limit(1);
    return row?.countryCode ?? null;
  }

  const [row] = await db
    .select({ countryCode: requests.countryCode })
    .from(responses)
    .innerJoin(requests, eq(responses.requestId, requests.id))
    .where(eq(responses.id, entityId))
    .limit(1);
  return row?.countryCode ?? null;
}
