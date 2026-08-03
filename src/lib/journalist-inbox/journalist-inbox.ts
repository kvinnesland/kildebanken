import { and, count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contactRequests, requests, responses, users } from "@/db/schema";

export type InboxResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function findOwnedRequest(requestId: string, journalistUserId: string) {
  const [row] = await db
    .select({ id: requests.id })
    .from(requests)
    .where(and(eq(requests.id, requestId), eq(requests.journalistId, journalistUserId)))
    .limit(1);
  return row ?? null;
}

export interface ResponseListItem {
  id: string;
  displayNameSnapshot: string | null;
  // SPEC-V1.md 13: "visningsnavn, FØRSTE LINJE AV PRESENTASJONEN" — dette er
  // `short_bio` (12.1: "Kort presentasjon av deg selv"), IKKE
  // `relevanceStatement`. Feilet slik frem til denne rettelsen (økt 7, se
  // NATTLOGG.md) — `relevanceStatement` var det som faktisk ble vist i
  // listen. `shortBio` er valgfritt, så `relevanceStatement` beholdes som
  // fallback for "første linje" når presentasjonen mangler, ikke fordi
  // spec-en ber om det.
  shortBio: string | null;
  relevanceStatement: string;
  submittedAt: Date;
  journalistMarking: "unreviewed" | "shortlisted" | "not_selected";
  viewedAt: Date | null;
  hasSharedEmail: boolean;
}

export interface ResponseListSummary {
  totalResponses: number;
  unreadResponses: number;
  shortlistedResponses: number;
  contactRequestCount: number;
}

/**
 * GET /journalist/requests/:id/responses (SPEC-V1.md 20, 13). Kun aktive
 * svar (`lifecycle_status = submitted`) — trukne finnes ikke lenger
 * (hard-slettet, `withdrawResponse()`), skjulte av moderator vises ikke
 * her heller (`hidden_by_moderator`).
 */
export async function listResponsesForRequest(
  requestId: string,
  journalistUserId: string
): Promise<InboxResult<{ summary: ResponseListSummary; items: ResponseListItem[] }>> {
  const owned = await findOwnedRequest(requestId, journalistUserId);
  if (!owned) return { ok: false, error: "errors.not_found" };

  const rows = await db
    .select({
      id: responses.id,
      displayNameSnapshot: responses.displayNameSnapshot,
      shortBio: responses.shortBio,
      relevanceStatement: responses.relevanceStatement,
      submittedAt: responses.submittedAt,
      journalistMarking: responses.journalistMarking,
      viewedAt: responses.viewedAt,
      contactSharing: responses.contactSharing,
    })
    .from(responses)
    .where(and(eq(responses.requestId, requestId), eq(responses.lifecycleStatus, "submitted")));

  const approvedContactByResponse = new Set(
    (
      await db
        .select({ responseId: contactRequests.responseId })
        .from(contactRequests)
        .innerJoin(responses, eq(contactRequests.responseId, responses.id))
        .where(and(eq(responses.requestId, requestId), eq(contactRequests.status, "approved")))
    )
      .map((r) => r.responseId)
      .filter((id): id is string => id !== null)
  );

  const items: ResponseListItem[] = rows.map((r) => ({
    id: r.id,
    displayNameSnapshot: r.displayNameSnapshot,
    shortBio: r.shortBio,
    relevanceStatement: r.relevanceStatement,
    submittedAt: r.submittedAt,
    journalistMarking: r.journalistMarking,
    viewedAt: r.viewedAt,
    hasSharedEmail: r.contactSharing === "email" || approvedContactByResponse.has(r.id),
  }));

  const [contactRequestRow] = await db
    .select({ value: count() })
    .from(contactRequests)
    .innerJoin(responses, eq(contactRequests.responseId, responses.id))
    .where(eq(responses.requestId, requestId));

  const summary: ResponseListSummary = {
    totalResponses: items.length,
    unreadResponses: items.filter((i) => !i.viewedAt).length,
    shortlistedResponses: items.filter((i) => i.journalistMarking === "shortlisted").length,
    contactRequestCount: contactRequestRow?.value ?? 0,
  };

  return { ok: true, data: { summary, items } };
}

export interface ResponseDetail {
  id: string;
  requestId: string;
  displayNameSnapshot: string | null;
  relevanceStatement: string;
  answerText: string;
  shortBio: string | null;
  contactSharing: "none" | "email";
  // Kun satt når contactSharing="email" (12.2, ordrett: "Del e-postadressen
  // min med journalisten – adressen følger svaret"). Reelt hull frem til nå
  // (se NATTLOGG.md): dette valget ble lagret og korrekt behandlet av
  // createContactRequest() (avviser en overflødig kontaktforespørsel med
  // errors.contact_already_shared, "adressen er allerede delt"), men selve
  // adressen ble ALDRI faktisk vist til journalisten noe sted — verken her
  // eller i "nytt svar mottatt"-varselet. Sammenlignet med DEN andre
  // delingsveien (en godkjent ContactRequest.sharedEmail, se
  // getContactRequestDetail() i contact-requests.ts) for samme mønster.
  sharedEmail: string | null;
  journalistMarking: "unreviewed" | "shortlisted" | "not_selected";
  journalistNote: string | null;
  submittedAt: Date;
  viewedAt: Date | null;
}

/**
 * GET /journalist/responses/:id. Setter `viewed_at` FØRSTE gang
 * detaljvisningen åpnes (13: "utløser ingen notifikasjon til respondenten
 * utover statusen hen kan se selv") — utløser derfor ingen e-post her.
 */
export async function getResponseDetailForJournalist(
  responseId: string,
  journalistUserId: string
): Promise<InboxResult<ResponseDetail>> {
  const [row] = await db
    .select({
      id: responses.id,
      requestId: responses.requestId,
      requestJournalistId: requests.journalistId,
      displayNameSnapshot: responses.displayNameSnapshot,
      relevanceStatement: responses.relevanceStatement,
      answerText: responses.answerText,
      shortBio: responses.shortBio,
      contactSharing: responses.contactSharing,
      respondentEmail: users.email,
      journalistMarking: responses.journalistMarking,
      journalistNote: responses.journalistNote,
      submittedAt: responses.submittedAt,
      viewedAt: responses.viewedAt,
      lifecycleStatus: responses.lifecycleStatus,
    })
    .from(responses)
    .innerJoin(requests, eq(responses.requestId, requests.id))
    .innerJoin(users, eq(responses.respondentId, users.id))
    .where(eq(responses.id, responseId))
    .limit(1);

  if (!row || row.requestJournalistId !== journalistUserId || row.lifecycleStatus !== "submitted") {
    return { ok: false, error: "errors.not_found" };
  }

  if (!row.viewedAt) {
    const now = new Date();
    await db.update(responses).set({ viewedAt: now }).where(eq(responses.id, responseId));
    row.viewedAt = now;
  }

  const { requestJournalistId: _omit, lifecycleStatus: _omit2, respondentEmail, ...rest } = row;
  const detail: ResponseDetail = {
    ...rest,
    sharedEmail: row.contactSharing === "email" ? respondentEmail : null,
  };
  return { ok: true, data: detail };
}

export type JournalistMarking = "unreviewed" | "shortlisted" | "not_selected";

/**
 * PATCH /journalist/responses/:id/status (SPEC-V1.md 20, 13.1). Setter
 * `journalist_marking` og/eller `journalist_note` — ALDRI `lifecycle_status`,
 * som eies av respondenten alene (19.7). Ingen av delene er synlige for
 * respondenten (13.1, ordrett).
 */
export async function updateResponseMarking(
  responseId: string,
  journalistUserId: string,
  input: { marking?: JournalistMarking; note?: string | null }
): Promise<InboxResult<null>> {
  const [row] = await db
    .select({ requestJournalistId: requests.journalistId, lifecycleStatus: responses.lifecycleStatus })
    .from(responses)
    .innerJoin(requests, eq(responses.requestId, requests.id))
    .where(eq(responses.id, responseId))
    .limit(1);

  if (!row || row.requestJournalistId !== journalistUserId || row.lifecycleStatus !== "submitted") {
    return { ok: false, error: "errors.not_found" };
  }

  const patch: { journalistMarking?: JournalistMarking; journalistNote?: string | null } = {};
  if (input.marking !== undefined) patch.journalistMarking = input.marking;
  if (input.note !== undefined) patch.journalistNote = input.note;

  if (Object.keys(patch).length === 0) return { ok: true, data: null };

  // `lifecycleStatus = "submitted"` i WHERE-betingelsen (ikke bare i sjekken
  // over) lukker samme TOCTOU-vindu som `hideResponse()` (moderation/
  // responses.ts) allerede lukker på SIN side av akkurat denne raden — uten
  // denne betingelsen kunne en samtidig `hideResponse()`/`withdrawResponse()`
  // mellom SELECT og UPDATE la denne skrivingen slå igjennom på et svar som
  // akkurat ble skjult/trukket, stille i strid med at et skjult/trukket svar
  // skal være utilgjengelig for journalisten (13, 19.7).
  const [updated] = await db
    .update(responses)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(responses.id, responseId), eq(responses.lifecycleStatus, "submitted")))
    .returning({ id: responses.id });
  if (!updated) return { ok: false, error: "errors.not_found" };

  return { ok: true, data: null };
}
