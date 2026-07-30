import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, requests, responses } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/authorize";

// 16.2 (lagt til under autonomt arbeid, økt 7, se NATTLOGG.md) — en lukket
// liste, IKKE fritekst. Fritekst (som ved avvisning av en forespørsel) er
// moderatorens EGET resonnement i egne ord; dette er en av fire faste
// kategorier, nettopp for å kunne revidere alle oppslag av én kategori i
// etterkant.
export const ADMIN_RESPONSE_ACCESS_REASONS = [
  "user_support_request",
  "abuse_report_investigation",
  "legal_or_regulatory_request",
  "security_incident",
] as const;

export type AdminResponseAccessReason = (typeof ADMIN_RESPONSE_ACCESS_REASONS)[number];

export interface AdminResponseDetail {
  id: string;
  requestId: string;
  respondentId: string;
  displayNameSnapshot: string | null;
  relevanceStatement: string;
  answerText: string;
  shortBio: string | null;
  contactSharing: "none" | "email";
  lifecycleStatus: "submitted" | "withdrawn" | "hidden_by_moderator" | "deleted";
  journalistMarking: "unreviewed" | "shortlisted" | "not_selected";
  submittedAt: Date;
}

export type AdminResponseResult =
  | { ok: true; response: AdminResponseDetail }
  | { ok: false; error: string };

/**
 * GET /admin/responses/:id (SPEC-V1.md 16.2, FR-051). Krever administrator
 * spesifikt (FR-051, ordrett — ikke moderator) og en begrunnelse fra listen
 * over. Loggfører oppslaget MED begrunnelsen (16.2: "Oppslaget logges med
 * begrunnelsen") FØR svaret returneres, slik at et oppslag alltid er
 * loggført selv om noe skulle feile lenger ute i kallkjeden.
 *
 * Filtrerer bevisst IKKE på `lifecycle_status` slik journalistens egen
 * innboks gjør (`journalist-inbox.ts`, kun `submitted`) — poenget med denne
 * ruten er nettopp unntaksvis tilgang, inkludert til svar en moderator
 * allerede har skjult (`hidden_by_moderator`), f.eks. under en
 * misbruksundersøkelse. Et trukket svar (`withdrawn`) er uansett
 * hard-slettet og finnes ikke lenger som rad (17.4).
 */
export async function getResponseForAdmin(
  responseId: string,
  reason: AdminResponseAccessReason
): Promise<AdminResponseResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "errors.not_authorized" };

  const [row] = await db
    .select({
      id: responses.id,
      requestId: responses.requestId,
      respondentId: responses.respondentId,
      displayNameSnapshot: responses.displayNameSnapshot,
      relevanceStatement: responses.relevanceStatement,
      answerText: responses.answerText,
      shortBio: responses.shortBio,
      contactSharing: responses.contactSharing,
      lifecycleStatus: responses.lifecycleStatus,
      journalistMarking: responses.journalistMarking,
      submittedAt: responses.submittedAt,
      countryCode: requests.countryCode,
    })
    .from(responses)
    .innerJoin(requests, eq(responses.requestId, requests.id))
    .where(eq(responses.id, responseId))
    .limit(1);

  if (!row) return { ok: false, error: "errors.not_found" };

  await db.insert(auditLogs).values({
    actorType: "user",
    actorUserId: session.userId,
    countryCode: row.countryCode,
    action: "response.admin_view",
    entityType: "response",
    entityId: responseId,
    reason,
  });

  const { countryCode: _omit, ...response } = row;
  return { ok: true, response };
}
