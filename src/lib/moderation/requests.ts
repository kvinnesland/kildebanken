import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, journalistProfiles, requests, users } from "@/db/schema";
import { sendTransactionalEmail } from "@/lib/email/send";
import { checkModeratorForCountry, getAssignedCountryCodes } from "@/lib/auth/authorize";
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
      slug: requests.slug,
      title: requests.title,
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

  // FR-023: en moderator tildelt et ANNET land skal få errors.not_found
  // (404), ikke errors.not_authorized (403) — se checkModeratorForCountry()
  // i auth/authorize.ts for hvorfor.
  const check = await checkModeratorForCountry(request.countryCode);
  if (check.status === "unauthorized") return { ok: false, error: "errors.not_authorized" };
  if (check.status === "wrong_country") return { ok: false, error: "errors.not_found" };
  const session = check.session;

  const [publishedRow] = await db
    .select({ value: count() })
    .from(requests)
    .where(and(eq(requests.journalistId, request.journalistId), eq(requests.status, "published")));

  if ((publishedRow?.value ?? 0) >= MAX_CONCURRENT_PUBLISHED) {
    return { ok: false, error: "errors.too_many_published_requests" };
  }

  // status="submitted" i WHERE-betingelsen (ikke bare i sjekken over) lukker
  // TOCTOU-vinduet mellom sjekken og denne skrivingen — flere moderatorer
  // tildelt samme land ser samme moderasjonskø samtidig (4), og uten denne
  // betingelsen kunne to av dem rekke å passere sjekken før noen skrev, og
  // siden overskrive hverandre (én publiserer, én avviser), med tilhørende
  // motstridende e-post og revisjonslogg til begge utfall (samme mønster
  // som moderation/journalists.ts).
  const now = new Date();
  const [publishedResult] = await db
    .update(requests)
    .set({ status: "published", publishedAt: now, moderatedBy: session.userId, moderatedAt: now, updatedAt: now })
    .where(and(eq(requests.id, requestId), eq(requests.status, "submitted")))
    .returning({ id: requests.id });
  if (!publishedResult) return { ok: false, error: "errors.request_not_editable" };

  await db.insert(auditLogs).values({
    actorType: "user",
    actorUserId: session.userId,
    countryCode: request.countryCode,
    action: "request.publish",
    entityType: "request",
    entityId: requestId,
  });

  await notifyJournalist(request.journalistId, "request_approved_published", {
    requestId,
    title: request.title,
    slug: request.slug,
  });

  return { ok: true };
}

/** `submitted → rejected` (9.2). Begrunnelse obligatorisk (8/9.3-mønsteret:
 * moderatorkommentarer er alltid fritekst, aldri oversatt). */
export async function rejectRequest(requestId: string, reason: string): Promise<ModerationActionResult> {
  if (!reason.trim()) return { ok: false, error: "errors.reason_required" };

  const request = await findSubmitted(requestId);
  if (!request) return { ok: false, error: "errors.not_found" };
  if (request.status !== "submitted") return { ok: false, error: "errors.request_not_editable" };

  // FR-023: samme skille som i publishRequest() over.
  const check = await checkModeratorForCountry(request.countryCode);
  if (check.status === "unauthorized") return { ok: false, error: "errors.not_authorized" };
  if (check.status === "wrong_country") return { ok: false, error: "errors.not_found" };
  const session = check.session;

  // Samme TOCTOU-lukking som i publishRequest() over.
  const now = new Date();
  const [rejectedResult] = await db
    .update(requests)
    .set({
      status: "rejected",
      moderatorComment: reason,
      moderatedBy: session.userId,
      moderatedAt: now,
      updatedAt: now,
    })
    .where(and(eq(requests.id, requestId), eq(requests.status, "submitted")))
    .returning({ id: requests.id });
  if (!rejectedResult) return { ok: false, error: "errors.request_not_editable" };

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

  // FR-023: samme skille som i publishRequest() over.
  const check = await checkModeratorForCountry(request.countryCode);
  if (check.status === "unauthorized") return { ok: false, error: "errors.not_authorized" };
  if (check.status === "wrong_country") return { ok: false, error: "errors.not_found" };
  const session = check.session;

  // Samme TOCTOU-lukking som i publishRequest() over.
  const now = new Date();
  const [requestChangesResult] = await db
    .update(requests)
    .set({
      status: "changes_requested",
      moderatorComment: comment,
      moderatedBy: session.userId,
      moderatedAt: now,
      updatedAt: now,
    })
    .where(and(eq(requests.id, requestId), eq(requests.status, "submitted")))
    .returning({ id: requests.id });
  if (!requestChangesResult) return { ok: false, error: "errors.request_not_editable" };

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
 * samme mønster som listJournalists() i src/lib/moderation/journalists.ts.
 * Joiner journalistProfiles for VISNING (9.3: moderator må kunne vurdere
 * "legitimt journalistisk formål" — trenger å se HVEM som spør, ikke bare
 * selve teksten). */
export async function listModerationQueue(session: CurrentSession) {
  const assigned = await getAssignedCountryCodes(session);
  if (assigned !== "all" && assigned.length === 0) return [];

  const conditions = [eq(requests.status, "submitted")];
  if (assigned !== "all") conditions.push(inArray(requests.countryCode, assigned));

  return db
    .select({
      id: requests.id,
      title: requests.title,
      summary: requests.summary,
      description: requests.description,
      targetPersonDescription: requests.targetPersonDescription,
      countryCode: requests.countryCode,
      responseDeadline: requests.responseDeadline,
      createdAt: requests.createdAt,
      journalistFullName: journalistProfiles.fullName,
      organizationName: journalistProfiles.organizationName,
    })
    .from(requests)
    .innerJoin(journalistProfiles, eq(requests.journalistId, journalistProfiles.userId))
    .where(and(...conditions));
}
