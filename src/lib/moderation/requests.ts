import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, requests, users } from "@/db/schema";
import { sendTransactionalEmail } from "@/lib/email/send";
import { requireModeratorForCountry, getAssignedCountryCodes } from "@/lib/auth/authorize";
import type { CurrentSession } from "@/lib/auth/session";

const MAX_CONCURRENT_PUBLISHED = 5; // FR-029, samme grense som src/lib/requests/requests.ts

export type ModerationActionResult = { ok: true } | { ok: false; error: string };

async function findSubmitted(requestId: string) {
  const [row] = await db
    .select({
      id: requests.id,
      countryCode: requests.countryCode,
      journalistId: requests.journalistId,
      status: requests.status,
    })
    .from(requests)
    .where(eq(requests.id, requestId))
    .limit(1);
  return row ?? null;
}

async function notifyJournalist(
  journalistId: string,
  template: "request_approved_published" | "changes_requested" | "request_rejected",
  data: Record<string, unknown>
) {
  const [journalist] = await db
    .select({ email: users.email, locale: users.locale })
    .from(users)
    .where(eq(users.id, journalistId))
    .limit(1);
  if (journalist) {
    await sendTransactionalEmail({ template, to: { email: journalist.email, locale: journalist.locale }, data });
  }
}

/**
 * `submitted → published` (9.2). Re-håndhever FR-029 HER, ikke bare ved
 * `submit` (se TODO fjernet fra src/lib/requests/requests.ts, NATTLOGG.md
 * økt 6) — dette lukker hullet der flere innsendte forespørsler i prinsippet
 * kunne godkjennes samtidig og bryte 5-grensen.
 */
export async function publishRequest(requestId: string): Promise<ModerationActionResult> {
  const request = await findSubmitted(requestId);
  if (!request) return { ok: false, error: "errors.not_found" };
  if (request.status !== "submitted") return { ok: false, error: "errors.request_not_editable" };

  const session = await requireModeratorForCountry(request.countryCode);
  if (!session) return { ok: false, error: "errors.not_authorized" };

  const [publishedRow] = await db
    .select({ value: count() })
    .from(requests)
    .where(and(eq(requests.journalistId, request.journalistId), eq(requests.status, "published")));

  if ((publishedRow?.value ?? 0) >= MAX_CONCURRENT_PUBLISHED) {
    return { ok: false, error: "errors.too_many_published_requests" };
  }

  const now = new Date();
  await db
    .update(requests)
    .set({ status: "published", publishedAt: now, moderatedBy: session.userId, moderatedAt: now, updatedAt: now })
    .where(eq(requests.id, requestId));

  await db.insert(auditLogs).values({
    actorType: "user",
    actorUserId: session.userId,
    countryCode: request.countryCode,
    action: "request.publish",
    entityType: "request",
    entityId: requestId,
  });

  await notifyJournalist(request.journalistId, "request_approved_published", { requestId });

  return { ok: true };
}

/** `submitted → rejected` (9.2). Begrunnelse obligatorisk (8/9.3-mønsteret:
 * moderatorkommentarer er alltid fritekst, aldri oversatt). */
export async function rejectRequest(requestId: string, reason: string): Promise<ModerationActionResult> {
  if (!reason.trim()) return { ok: false, error: "errors.reason_required" };

  const request = await findSubmitted(requestId);
  if (!request) return { ok: false, error: "errors.not_found" };
  if (request.status !== "submitted") return { ok: false, error: "errors.request_not_editable" };

  const session = await requireModeratorForCountry(request.countryCode);
  if (!session) return { ok: false, error: "errors.not_authorized" };

  const now = new Date();
  await db
    .update(requests)
    .set({
      status: "rejected",
      moderatorComment: reason,
      moderatedBy: session.userId,
      moderatedAt: now,
      updatedAt: now,
    })
    .where(eq(requests.id, requestId));

  await db.insert(auditLogs).values({
    actorType: "user",
    actorUserId: session.userId,
    countryCode: request.countryCode,
    action: "request.reject",
    entityType: "request",
    entityId: requestId,
    reason,
  });

  await notifyJournalist(request.journalistId, "request_rejected", { requestId, reason });

  return { ok: true };
}

/** `submitted → changes_requested` (9.2). Kommentar obligatorisk. */
export async function requestChanges(requestId: string, comment: string): Promise<ModerationActionResult> {
  if (!comment.trim()) return { ok: false, error: "errors.reason_required" };

  const request = await findSubmitted(requestId);
  if (!request) return { ok: false, error: "errors.not_found" };
  if (request.status !== "submitted") return { ok: false, error: "errors.request_not_editable" };

  const session = await requireModeratorForCountry(request.countryCode);
  if (!session) return { ok: false, error: "errors.not_authorized" };

  const now = new Date();
  await db
    .update(requests)
    .set({
      status: "changes_requested",
      moderatorComment: comment,
      moderatedBy: session.userId,
      moderatedAt: now,
      updatedAt: now,
    })
    .where(eq(requests.id, requestId));

  await db.insert(auditLogs).values({
    actorType: "user",
    actorUserId: session.userId,
    countryCode: request.countryCode,
    action: "request.request_changes",
    entityType: "request",
    entityId: requestId,
    reason: comment,
  });

  await notifyJournalist(request.journalistId, "changes_requested", { requestId, comment });

  return { ok: true };
}

/** GET /admin/moderation/requests — filtrert på moderatorens tildelte land,
 * samme mønster som listJournalists() i src/lib/moderation/journalists.ts. */
export async function listModerationQueue(session: CurrentSession) {
  const assigned = await getAssignedCountryCodes(session);
  if (assigned !== "all" && assigned.length === 0) return [];

  const conditions = [eq(requests.status, "submitted")];
  if (assigned !== "all") conditions.push(inArray(requests.countryCode, assigned));

  return db
    .select()
    .from(requests)
    .where(and(...conditions));
}
