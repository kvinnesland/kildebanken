import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, journalistProfiles, users } from "@/db/schema";
import { sendTransactionalEmail } from "@/lib/email/send";
import { requireModeratorForCountry, getAssignedCountryCodes } from "@/lib/auth/authorize";
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

  const session = await requireModeratorForCountry(journalist.countryCode);
  if (!session) return { ok: false, error: "errors.not_authorized" };

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

  await sendTransactionalEmail({
    template: "journalist_approved",
    to: { email: journalist.email, locale: journalist.locale },
    data: {},
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

  const session = await requireModeratorForCountry(journalist.countryCode);
  if (!session) return { ok: false, error: "errors.not_authorized" };

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

  await sendTransactionalEmail({
    template: "journalist_rejected",
    to: { email: journalist.email, locale: journalist.locale },
    data: { reason },
  });

  return { ok: true };
}

export interface JournalistListItem {
  userId: string;
  email: string;
  fullName: string;
  jobTitle: string;
  organizationName: string;
  organizationUrl: string;
  countryCode: string;
  verificationStatus: "pending_review" | "approved" | "rejected";
  createdAt: Date;
}

/**
 * Filtrert på moderatorens tildelte land (SPEC-V1.md 4) — administrator ser
 * alle. En moderator uten landtildeling ser en tom liste, ikke alle
 * journalister — feil retning å lekke mot ved en konfigurasjonsfeil.
 */
export async function listJournalists(
  session: CurrentSession,
  statusFilter?: "pending_review" | "approved" | "rejected"
): Promise<JournalistListItem[]> {
  const assigned = await getAssignedCountryCodes(session);
  if (assigned !== "all" && assigned.length === 0) return [];

  const conditions = [eq(users.role, "journalist")];
  if (assigned !== "all") conditions.push(inArray(users.countryCode, assigned));
  if (statusFilter) conditions.push(eq(journalistProfiles.verificationStatus, statusFilter));

  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
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

  return rows;
}
