import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, contactRequests, users } from "@/db/schema";
import { revokeAllSessionsForUser } from "@/lib/auth/session";
import { requireModeratorForCountry } from "@/lib/auth/authorize";

export type SuspendUserResult = { ok: true } | { ok: false; error: string };

/**
 * POST /admin/users/:id/suspend (SPEC-V1.md 8.1, 16.2). Journalistens
 * publiserte forespørsler skjules umiddelbart av en SYNLIGHETSREGEL på
 * lesesiden (se `getPublicRequest()` i src/lib/requests/requests.ts og
 * `runDigestTick()` i src/lib/jobs/tick.ts, begge filtrert på
 * `User.status = active`) — ikke ved å skrive noe på selve
 * forespørselsraden. Reverseres derfor automatisk av `unsuspendUser()` under,
 * uten noen egen "vis igjen"-handling.
 *
 * Innlogging blokkeres allerede universelt for enhver `status !== active`
 * (se `getCurrentSession()`), og `submitResponse()` sjekker det samme for
 * respondenter — suspensjon av en mottaker krever derfor ingen egen kode her
 * utover selve statusendringen.
 */
export async function suspendUser(userId: string, reason: string): Promise<SuspendUserResult> {
  if (!reason.trim()) return { ok: false, error: "errors.reason_required" };

  const [user] = await db
    .select({ id: users.id, role: users.role, status: users.status, countryCode: users.countryCode })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return { ok: false, error: "errors.not_found" };

  const session = await requireModeratorForCountry(user.countryCode);
  if (!session) return { ok: false, error: "errors.not_authorized" };

  if (user.status === "deleted") return { ok: false, error: "errors.not_found" };
  if (user.status === "suspended") return { ok: true }; // idempotent

  await db.update(users).set({ status: "suspended", updatedAt: new Date() }).where(eq(users.id, userId));
  await revokeAllSessionsForUser(userId);

  // 8.1: "åpne kontaktforespørsler kanselleres" — kun journalistens EGNE,
  // ventende kontaktforespørsler, ikke svarene selv (de "beholdes, men er
  // ikke tilgjengelige for journalisten" — allerede sant, siden journalisten
  // uansett ikke kan logge inn nå).
  if (user.role === "journalist") {
    await db
      .update(contactRequests)
      .set({ status: "cancelled" })
      .where(and(eq(contactRequests.journalistId, userId), eq(contactRequests.status, "pending")));
  }

  await db.insert(auditLogs).values({
    actorType: "user",
    actorUserId: session.userId,
    countryCode: user.countryCode,
    action: "user.suspend",
    entityType: "user",
    entityId: userId,
    reason,
  });

  return { ok: true };
}

/**
 * POST /admin/users/:id/unsuspend. `verification_status` (journalist) røres
 * IKKE — 8.1, siste avsnitt: "oppheves suspensjonen, er journalisten
 * fortsatt `approved` uten ny moderatorbehandling."
 */
export async function unsuspendUser(userId: string): Promise<SuspendUserResult> {
  const [user] = await db
    .select({ id: users.id, status: users.status, countryCode: users.countryCode })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return { ok: false, error: "errors.not_found" };

  const session = await requireModeratorForCountry(user.countryCode);
  if (!session) return { ok: false, error: "errors.not_authorized" };

  if (user.status !== "suspended") return { ok: false, error: "errors.validation_failed" };

  await db.update(users).set({ status: "active", updatedAt: new Date() }).where(eq(users.id, userId));

  await db.insert(auditLogs).values({
    actorType: "user",
    actorUserId: session.userId,
    countryCode: user.countryCode,
    action: "user.unsuspend",
    entityType: "user",
    entityId: userId,
  });

  return { ok: true };
}
