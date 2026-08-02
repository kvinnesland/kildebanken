import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, consentRecords, contactRequests, suppressions, users } from "@/db/schema";
import { revokeAllSessionsForUser } from "@/lib/auth/session";
import { checkModeratorForCountry, getAssignedCountryCodes } from "@/lib/auth/authorize";
import { hashToken } from "@/lib/auth/tokens";
import { performAccountDeletion } from "@/lib/auth/account-deletion";
import type { CurrentSession } from "@/lib/auth/session";

export type SuspendUserResult = { ok: true } | { ok: false; error: string };

export interface UserSearchResultConsent {
  consentType: string;
  granted: boolean;
  grantedAt: Date;
  withdrawnAt: Date | null;
}

export interface UserSearchResult {
  id: string;
  email: string;
  status: "pending_email_verification" | "active" | "suspended" | "deleted";
  countryCode: string;
  createdAt: Date;
  consents: UserSearchResultConsent[];
}

const SEARCH_RESULT_LIMIT = 20;

/**
 * GET /admin/users?email=... (SPEC-V1.md 16.2: "søk på e-postadresse, se
 * kontostatus og samtykkehistorikk") — filtrert på moderatorens tildelte
 * land, samme mønster som `listDigests()`. Scoped til `role = recipient`,
 * nøyaktig som 16.2 selv scoper "Mottakere"-seksjonen (journalistsøk lever
 * under "Journalister", en annen, ennå ubygget del av samme seksjon).
 * Delvis, versalufølsomt treff (`ilike`) — en moderator husker sjelden en
 * hel adresse ordrett. `SEARCH_RESULT_LIMIT` er en enkel, ikke spec-krevd
 * sikkerhetsventil mot et vidt søk (f.eks. ett enkelt tegn) som ville
 * returnert svært mange rader.
 */
export async function searchUsersByEmail(
  session: CurrentSession,
  emailQuery: string
): Promise<UserSearchResult[]> {
  const trimmed = emailQuery.trim().toLowerCase();
  if (!trimmed) return [];

  const assigned = await getAssignedCountryCodes(session);
  if (assigned !== "all" && assigned.length === 0) return [];

  const conditions = [eq(users.role, "recipient"), ilike(users.email, `%${trimmed}%`)];
  if (assigned !== "all") conditions.push(inArray(users.countryCode, assigned));

  const matches = await db
    .select({
      id: users.id,
      email: users.email,
      status: users.status,
      countryCode: users.countryCode,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(...conditions))
    .limit(SEARCH_RESULT_LIMIT);

  if (matches.length === 0) return [];

  const userIds = matches.map((m) => m.id);
  const consentRows = await db
    .select({
      userId: consentRecords.userId,
      consentType: consentRecords.consentType,
      granted: consentRecords.granted,
      grantedAt: consentRecords.grantedAt,
      withdrawnAt: consentRecords.withdrawnAt,
    })
    .from(consentRecords)
    .where(inArray(consentRecords.userId, userIds))
    .orderBy(desc(consentRecords.createdAt));

  const consentsByUser = new Map<string, UserSearchResultConsent[]>();
  for (const row of consentRows) {
    const list = consentsByUser.get(row.userId) ?? [];
    list.push({
      consentType: row.consentType,
      granted: row.granted,
      grantedAt: row.grantedAt,
      withdrawnAt: row.withdrawnAt,
    });
    consentsByUser.set(row.userId, list);
  }

  return matches.map((m) => ({ ...m, consents: consentsByUser.get(m.id) ?? [] }));
}

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

  // FR-023: en moderator tildelt et ANNET land skal få errors.not_found
  // (404), ikke errors.not_authorized (403) — se checkModeratorForCountry()
  // i auth/authorize.ts for hvorfor.
  const check = await checkModeratorForCountry(user.countryCode);
  if (check.status === "unauthorized") return { ok: false, error: "errors.not_authorized" };
  if (check.status === "wrong_country") return { ok: false, error: "errors.not_found" };
  const session = check.session;

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

  // FR-023: se suspendUser() over.
  const check = await checkModeratorForCountry(user.countryCode);
  if (check.status === "unauthorized") return { ok: false, error: "errors.not_authorized" };
  if (check.status === "wrong_country") return { ok: false, error: "errors.not_found" };
  const session = check.session;

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

/**
 * POST /admin/users/:id/suppress-email (SPEC-V1.md 12.5, 19.13). Det
 * fjerde og siste av moderatorens fire tiltak etter en rapportering
 * ("lukke forespørselen, skjule et svar, suspendere kontoen, sperre
 * e-postadressen") — de tre andre var allerede bygget
 * (`closeRequest()`, `hideResponse()`, `suspendUser()`); denne manglet
 * fullstendig frem til nå (se NATTLOGG.md, økt 7). `suppressions` hadde
 * fra starten en `manual`-verdi i `reason`-enumen, brukt av INGEN kode
 * noe sted — kun de automatiske grunnene (`unsubscribed`, `hard_bounce`,
 * `complaint`) ble noensinne satt.
 *
 * En UAVHENGIG handling fra `suspendUser()`, ikke en kombinasjon av dem —
 * 12.5 lister dem som fire DISTINKTE verktøy, ikke én bunt. Sperrer
 * adressen mot fremtidig REGISTRERING og UTSENDELSE (19.13: global på
 * tvers av land), men rører ikke selve kontoens `status` — en moderator
 * som vil gjøre begge deler kaller `suspendUser()` separat.
 *
 * `.onConflictDoNothing()` (samme mønster som `unsubscribeByToken()`) gjør
 * dette idempotent uten en egen forhåndssjekk — den unike indeksen på
 * `email_hash` er selve garantien.
 *
 * Avviser en allerede SLETTET konto (samme guard som `suspendUser()`) —
 * `account-deletion.ts` har på det tidspunktet allerede erstattet
 * `users.email` med en hash av den ekte adressen (17.5); å hashe DEN på
 * nytt her ville sperret feil verdi og ikke faktisk hindret at den EKTE
 * adressen registreres igjen.
 */
export async function suppressUserEmail(userId: string, reason: string): Promise<SuspendUserResult> {
  if (!reason.trim()) return { ok: false, error: "errors.reason_required" };

  const [user] = await db
    .select({ id: users.id, email: users.email, status: users.status, countryCode: users.countryCode })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return { ok: false, error: "errors.not_found" };

  // FR-023: se suspendUser() over.
  const check = await checkModeratorForCountry(user.countryCode);
  if (check.status === "unauthorized") return { ok: false, error: "errors.not_authorized" };
  if (check.status === "wrong_country") return { ok: false, error: "errors.not_found" };
  const session = check.session;

  if (user.status === "deleted") return { ok: false, error: "errors.not_found" };

  await db
    .insert(suppressions)
    .values({ emailHash: hashToken(user.email), reason: "manual" })
    .onConflictDoNothing();

  await db.insert(auditLogs).values({
    actorType: "user",
    actorUserId: session.userId,
    countryCode: user.countryCode,
    action: "user.suppress_email",
    entityType: "user",
    entityId: userId,
    reason,
  });

  return { ok: true };
}

/**
 * POST /admin/users/:id/delete (SPEC-V1.md 16.2: "gjennomfør sletting").
 * Kaller nøyaktig samme `performAccountDeletion()` som den selvbetjente
 * to-stegs tokenflyten (`src/lib/auth/account-deletion.ts`, 18.2) — men
 * UTEN noen bekreftelseslenke: moderatoren har allerede autentisert seg og
 * tar en bevisst, direkte beslutning (typisk etter en misbruksrapport),
 * til forskjell fra `/me/request-deletion` der brukeren selv ber om det
 * og MÅ bekrefte via en egen e-post (18.2s prinsipp gjelder der nettopp
 * fordi forespørselen kan komme fra hvem som helst med tilgang til
 * innloggingsøkten — her er selve moderator-autentiseringen allerede den
 * ferske autentiseringen).
 *
 * Scoped til `role = recipient` — 16.2 lister denne handlingen KUN under
 * "Mottakere", ikke under "Journalister" (som bare lister suspender/opphev
 * suspensjon). Sender inn `session.userId` som `actorUserId` slik at
 * revisjonsloggen viser moderatoren, ikke mottakeren selv, som utførende.
 */
export async function adminDeleteUser(userId: string): Promise<SuspendUserResult> {
  const [user] = await db
    .select({ id: users.id, role: users.role, status: users.status, countryCode: users.countryCode })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return { ok: false, error: "errors.not_found" };

  if (user.role !== "recipient") return { ok: false, error: "errors.validation_failed" };

  // FR-023: se suspendUser() over.
  const check = await checkModeratorForCountry(user.countryCode);
  if (check.status === "unauthorized") return { ok: false, error: "errors.not_authorized" };
  if (check.status === "wrong_country") return { ok: false, error: "errors.not_found" };
  const session = check.session;

  if (user.status === "deleted") return { ok: false, error: "errors.not_found" };

  await performAccountDeletion(userId, user.role, session.userId);

  return { ok: true };
}
