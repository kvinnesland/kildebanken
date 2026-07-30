import { and, count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contactRequests, requests, responses } from "@/db/schema";

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
      journalistMarking: responses.journalistMarking,
      journalistNote: responses.journalistNote,
      submittedAt: responses.submittedAt,
      viewedAt: responses.viewedAt,
      lifecycleStatus: responses.lifecycleStatus,
    })
    .from(responses)
    .innerJoin(requests, eq(responses.requestId, requests.id))
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

  const { requestJournalistId: _omit, lifecycleStatus: _omit2, ...detail } = row;
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

  await db.update(responses).set({ ...patch, updatedAt: new Date() }).where(eq(responses.id, responseId));

  return { ok: true, data: null };
}
