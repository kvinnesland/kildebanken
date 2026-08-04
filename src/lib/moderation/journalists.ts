import { and, count, eq, ilike, inArray, notInArray } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, journalistProfiles, requests, users } from "@/db/schema";
import { sendTransactionalEmail } from "@/lib/email/send";
import { resolveSenderIdentity } from "@/lib/email/sender-identity";
import { checkModeratorForCountry, getAssignedCountryCodes } from "@/lib/auth/authorize";
import type { CurrentSession } from "@/lib/auth/session";

export type ModerationResult = { ok: true } | { ok: false; error: string };

async function findJournalist(journalistUserId: string) {
  const [row] = await db
    .select({
      userId: users.id,
      email: users.email,
      locale: users.locale,
      countryCode: users.countryCode,
      profileId: journalistProfiles.id,
      verificationStatus: journalistProfiles.verificationStatus,
    })
    .from(users)
    .innerJoin(journalistProfiles, eq(journalistProfiles.userId, users.id))
    .where(and(eq(users.id, journalistUserId), eq(users.role, "journalist")))
    .limit(1);

  return row ?? null;
}

/**
 * SPEC-V1.md 8: moderator (tildelt landet) eller administrator kan
 * godkjenne. FR-050: alle moderator-/administratorhandlinger logges.
 *
 * `verification_status` er ENDELIG én gang satt (8.1, presisert økt 7) —
 * avviser derfor en søknad som ikke lenger er `pending_review`, samme
 * re-håndhevelses-mønster som `publishRequest()` i moderation/requests.ts
 * (to moderatorer som handler samtidig, eller en gjentatt forespørsel, skal
 * ikke kunne flippe status frem og tilbake).
 */
export async function approveJournalist(journalistUserId: string): Promise<ModerationResult> {
  const journalist = await findJournalist(journalistUserId);
  if (!journalist) return { ok: false, error: "errors.not_found" };
  if (journalist.verificationStatus !== "pending_review") {
    return { ok: false, error: "errors.journalist_not_pending_review" };
  }

  // FR-023: en moderator tildelt et ANNET land skal få errors.not_found
  // (404), ikke errors.not_authorized (403) — se checkModeratorForCountry()
  // i auth/authorize.ts for hvorfor.
  const check = await checkModeratorForCountry(journalist.countryCode);
  if (check.status === "unauthorized") return { ok: false, error: "errors.not_authorized" };
  if (check.status === "wrong_country") return { ok: false, error: "errors.not_found" };
  const session = check.session;

  // status="pending_review" i WHERE-betingelsen (ikke bare i sjekken over)
  // lukker TOCTOU-vinduet mellom sjekken og denne skrivingen — to
  // moderatorer tildelt samme land kan se den samme køen samtidig (4), og
  // uten denne betingelsen kunne begge rekke å passere sjekken før noen av
  // dem skrev, og siden overskrive hverandre (én godkjenner, én avviser),
  // med tilhørende motstridende e-post og revisjonslogg til begge utfall.
  const [approved] = await db
    .update(journalistProfiles)
    .set({ verificationStatus: "approved", reviewedBy: session.userId, reviewedAt: new Date() })
    .where(
      and(
        eq(journalistProfiles.id, journalist.profileId),
        eq(journalistProfiles.verificationStatus, "pending_review")
      )
    )
    .returning({ id: journalistProfiles.id });
  if (!approved) return { ok: false, error: "errors.journalist_not_pending_review" };

  await db.insert(auditLogs).values({
    actorType: "user",
    actorUserId: session.userId,
    countryCode: journalist.countryCode,
    action: "journalist.approve",
    entityType: "journalist_profile",
    entityId: journalist.profileId,
  });

  // SPEC-V1.md 10.4 — se resolveSenderIdentity() sin egen kommentar.
  const identity = await resolveSenderIdentity(journalist.countryCode, journalist.locale);

  await sendTransactionalEmail({
    template: "journalist_approved",
    to: { email: journalist.email, locale: journalist.locale },
    data: {},
    senderName: identity?.senderName,
    replyTo: identity?.replyTo,
    countryDefaultLocale: identity?.countryDefaultLocale,
  });

  return { ok: true };
}

/**
 * SPEC-V1.md 8: "Avvisning skal ha en begrunnelse som sendes til søkeren på
 * søkerens eget språk." Begrunnelsen skrives i fritekst av moderator og
 * oversettes ikke (samme prinsipp som moderator-kommentarer på
 * forespørsler, 9.3).
 */
export async function rejectJournalist(
  journalistUserId: string,
  reason: string
): Promise<ModerationResult> {
  if (!reason.trim()) return { ok: false, error: "errors.reason_required" };

  const journalist = await findJournalist(journalistUserId);
  if (!journalist) return { ok: false, error: "errors.not_found" };
  if (journalist.verificationStatus !== "pending_review") {
    return { ok: false, error: "errors.journalist_not_pending_review" };
  }

  // FR-023: se approveJournalist() over.
  const check = await checkModeratorForCountry(journalist.countryCode);
  if (check.status === "unauthorized") return { ok: false, error: "errors.not_authorized" };
  if (check.status === "wrong_country") return { ok: false, error: "errors.not_found" };
  const session = check.session;

  // Samme TOCTOU-lukking som i approveJournalist() over.
  const [rejected] = await db
    .update(journalistProfiles)
    .set({
      verificationStatus: "rejected",
      reviewedBy: session.userId,
      reviewedAt: new Date(),
      reviewNote: reason,
    })
    .where(
      and(
        eq(journalistProfiles.id, journalist.profileId),
        eq(journalistProfiles.verificationStatus, "pending_review")
      )
    )
    .returning({ id: journalistProfiles.id });
  if (!rejected) return { ok: false, error: "errors.journalist_not_pending_review" };

  await db.insert(auditLogs).values({
    actorType: "user",
    actorUserId: session.userId,
    countryCode: journalist.countryCode,
    action: "journalist.reject",
    entityType: "journalist_profile",
    entityId: journalist.profileId,
    reason,
  });

  // SPEC-V1.md 10.4 — se resolveSenderIdentity() sin egen kommentar.
  const identity = await resolveSenderIdentity(journalist.countryCode, journalist.locale);

  await sendTransactionalEmail({
    template: "journalist_rejected",
    to: { email: journalist.email, locale: journalist.locale },
    data: { reason },
    senderName: identity?.senderName,
    replyTo: identity?.replyTo,
    countryDefaultLocale: identity?.countryDefaultLocale,
  });

  return { ok: true };
}

export interface JournalistListItem {
  userId: string;
  email: string;
  status: "pending_email_verification" | "active" | "suspended" | "deleted";
  fullName: string;
  jobTitle: string;
  organizationName: string;
  organizationUrl: string;
  countryCode: string;
  verificationStatus: "pending_review" | "approved" | "rejected";
  createdAt: Date;
  // SPEC-V1.md 16.2: "se tidligere forespørsler" — antall forespørsler
  // journalisten faktisk har SENDT INN. Ekskluderer "draft" (aldri sendt
  // inn — bare et upublisert utkast ingen moderator noensinne så) og
  // "deleted" (slettet FØR publisering, DELETE /requests/:id — samme
  // "aldri egentlig en behandlet forespørsel"-begrunnelse som draft).
  pastRequestCount: number;
}

/**
 * Filtrert på moderatorens tildelte land (SPEC-V1.md 4) — administrator ser
 * alle. En moderator uten landtildeling ser en tom liste, ikke alle
 * journalister — feil retning å lekke mot ved en konfigurasjonsfeil.
 *
 * `emailQuery` (natt til 2026-08-01, se NATTLOGG.md) — 16.2s "søk" for
 * "Journalister" fantes ikke i det hele tatt før dette; delvis,
 * versalufølsomt (`ilike`), samme mønster som `searchUsersByEmail()` i
 * `moderation/users.ts`.
 */
export async function listJournalists(
  session: CurrentSession,
  statusFilter?: "pending_review" | "approved" | "rejected",
  emailQuery?: string
): Promise<JournalistListItem[]> {
  const assigned = await getAssignedCountryCodes(session);
  if (assigned !== "all" && assigned.length === 0) return [];

  const conditions = [eq(users.role, "journalist")];
  if (assigned !== "all") conditions.push(inArray(users.countryCode, assigned));
  if (statusFilter) conditions.push(eq(journalistProfiles.verificationStatus, statusFilter));
  const trimmedEmailQuery = emailQuery?.trim().toLowerCase();
  if (trimmedEmailQuery) conditions.push(ilike(users.email, `%${trimmedEmailQuery}%`));

  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      status: users.status,
      fullName: journalistProfiles.fullName,
      jobTitle: journalistProfiles.jobTitle,
      organizationName: journalistProfiles.organizationName,
      organizationUrl: journalistProfiles.organizationUrl,
      countryCode: users.countryCode,
      verificationStatus: journalistProfiles.verificationStatus,
      createdAt: journalistProfiles.createdAt,
    })
    .from(users)
    .innerJoin(journalistProfiles, eq(journalistProfiles.userId, users.id))
    .where(and(...conditions));

  if (rows.length === 0) return [];

  // Én gruppert spørring for ALLE journalistene i listen, ikke N+1 (samme
  // begrunnelse som listDigests() sin statustelling).
  const journalistIds = rows.map((r) => r.userId);
  const requestCounts = await db
    .select({ journalistId: requests.journalistId, value: count() })
    .from(requests)
    .where(
      and(inArray(requests.journalistId, journalistIds), notInArray(requests.status, ["draft", "deleted"]))
    )
    .groupBy(requests.journalistId);
  const countByJournalist = new Map(requestCounts.map((r) => [r.journalistId, r.value]));

  return rows.map((r) => ({ ...r, pastRequestCount: countByJournalist.get(r.userId) ?? 0 }));
}
