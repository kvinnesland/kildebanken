import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, contactRequests, requests, responses } from "@/db/schema";
import { requireModeratorForCountry } from "@/lib/auth/authorize";

export type ResponseModerationResult = { ok: true } | { ok: false; error: string };

async function findResponseForModeration(responseId: string) {
  const [row] = await db
    .select({
      id: responses.id,
      lifecycleStatus: responses.lifecycleStatus,
      countryCode: requests.countryCode,
    })
    .from(responses)
    .innerJoin(requests, eq(responses.requestId, requests.id))
    .where(eq(responses.id, responseId))
    .limit(1);
  return row ?? null;
}

/**
 * POST /admin/responses/:id/hide (SPEC-V1.md 12.5, FR-050). Ett av fire
 * tiltak en moderator kan sette i verk etter en rapportering — de tre andre
 * (lukke forespørselen, suspendere kontoen) var allerede bygget; denne
 * manglet fullstendig frem til nå (se NATTLOGG.md, økt 7:
 * `submitReport()`s egen kommentar forutsatte at "skjule" fantes et sted,
 * men ingen kode satte noensinne `lifecycle_status` til
 * `hidden_by_moderator`, til tross for at selve enum-verdien (19.7) alltid
 * har eksistert nettopp for dette formålet).
 *
 * Kun `submitted` kan skjules — et allerede trukket svar er hard-slettet
 * og finnes ikke lenger (17.4), og et allerede skjult svar har ingenting
 * mer å skjule. Samme re-håndhevelsesprinsipp som `moderation/requests.ts`
 * og `moderation/journalists.ts` (unngå at handlingen gjentas mot en
 * tilstand den ikke lenger gjelder for).
 *
 * Samme sideeffekt som en trekking (12.4: "åpne kontaktforespørsler
 * knyttet til det kanselleres") — svaret forsvinner fra journalistens
 * innboks (`journalist-inbox.ts` filtrerer på `lifecycle_status =
 * submitted`) uansett årsak, så en ventende kontaktforespørsel mot det bør
 * ikke bli stående ubesvarlig i limbo.
 *
 * Ingen egen `hidden_at`/`hidden_by`-kolonne — 19.7 sin fullstendige
 * feltliste for `Response` har ingen slike felt (bevisst ikke lagt til her
 * heller, se INFRASTRUCTURE.md-disiplinen om å ikke bygge utover spec-en);
 * FR-050-revisjonsloggen bærer ansvarligheten i stedet, samme mønster som
 * `country.status_change`.
 */
export async function hideResponse(responseId: string): Promise<ResponseModerationResult> {
  const response = await findResponseForModeration(responseId);
  if (!response) return { ok: false, error: "errors.not_found" };
  if (response.lifecycleStatus !== "submitted") {
    return { ok: false, error: "errors.response_not_visible" };
  }

  const session = await requireModeratorForCountry(response.countryCode);
  if (!session) return { ok: false, error: "errors.not_authorized" };

  await db
    .update(responses)
    .set({ lifecycleStatus: "hidden_by_moderator", updatedAt: new Date() })
    .where(eq(responses.id, responseId));

  await db
    .update(contactRequests)
    .set({ status: "cancelled" })
    .where(and(eq(contactRequests.responseId, responseId), eq(contactRequests.status, "pending")));

  await db.insert(auditLogs).values({
    actorType: "user",
    actorUserId: session.userId,
    countryCode: response.countryCode,
    action: "response.hide",
    entityType: "response",
    entityId: responseId,
  });

  return { ok: true };
}
