import "server-only";
import { cookies } from "next/headers";
import { eq, and, isNull, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { generateToken, hashToken } from "./tokens";

// Øktlevetid fra SPEC-V1.md 6.1/6.3 — se også 19.15 (rettet henvisning økt 7,
// var tidligere feilaktig "8.1/8.3", som ikke handler om øktlevetid).
const RECIPIENT_JOURNALIST_SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 dager
const MODERATOR_ADMIN_SESSION_MS = 12 * 60 * 60 * 1000; // 12 timer, fornyes ikke

const SESSION_COOKIE = "kb_session";

type SessionRole = "recipient" | "journalist" | "moderator" | "admin";

function sessionDurationMs(role: SessionRole): number {
  return role === "moderator" || role === "admin"
    ? MODERATOR_ADMIN_SESSION_MS
    : RECIPIENT_JOURNALIST_SESSION_MS;
}

export interface CreateSessionResult {
  rawToken: string;
  expiresAt: Date;
}

/** Oppretter en ny økt for brukeren og setter cookien. Kalles etter vellykket
 * `verify` — selve FØRSTEGANGSOPPRETTELSEN av en økt, uansett rolle. Den
 * LØPENDE fornyelsen for mottaker/journalist (6.1: "fornyes ved bruk") skjer
 * ikke her, men i `getCurrentSession()` hver gang en gyldig økt faktisk
 * brukes — se kommentaren der for hvorfor disse to ansvarene er atskilt. */
export async function createSession(
  userId: string,
  role: SessionRole
): Promise<CreateSessionResult> {
  const rawToken = generateToken();
  const expiresAt = new Date(Date.now() + sessionDurationMs(role));

  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return { rawToken, expiresAt };
}

export interface CurrentSession {
  sessionId: string;
  userId: string;
  role: SessionRole;
  countryCode: string;
  locale: string;
  email: string;
}

/** Slår opp gjeldende bruker fra sesjonscookien. Returnerer null dersom
 * ingen gyldig, ikke-utløpt og ikke-tilbakekalt økt finnes — utløpt og
 * tilbakekalt behandles likt (19.15: "ikke to ulike feilveier").
 *
 * `email` er med av én bestemt grunn (SPEC-V1.md 6.2): "Siden viser alltid
 * tydelig hvilken e-postadresse man er innlogget som, slik at en
 * videresendt e-post ikke fører til at noen svarer i feil navn ved et
 * uhell" — svarskjemaet (12) trenger å vise nettopp dette.
 *
 * 6.1: "Økt for mottaker og journalist: 30 dager, fornyes ved bruk" — et
 * glidende vindu, i motsetning til moderator/administrator (6.3: fast 12
 * timer, ingen fornyelse nevnt). `renewSessionIfApplicable()` under skyver
 * `sessions.expires_at` frem og setter `last_used_at` for de to første
 * rollene ved HVER gyldig bruk her — dette er DATABASE-sannheten, den
 * faktiske autoriteten for øktens gyldighet.
 *
 * Selve `kb_session`-INFORMASJONSKAPSELENS nettleser-utløpsdato fornyes
 * IKKE her (Next.js tillater `cookies().set()` kun fra en Server Action
 * eller Route Handler, og denne funksjonen kalles også fra vanlige Server
 * Component-sider der det ville kastet) — det gjøres i stedet i
 * `middleware.ts` (`renewSessionCookie()`, lagt til rett etter dette
 * fikset, se NATTLOGG.md økt 7), som kjører på HVER forespørsel (side eller
 * API) og alltid kan sette responscookies. Middleware gjør det BLINDT, uten
 * databasekall — trygt, siden cookiens levetid uansett bare er en
 * nettleser-side overlevelseshint, aldri selve autoriteten (den er, og
 * forblir, sjekken her). */
export async function getCurrentSession(): Promise<CurrentSession | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const [row] = await db
    .select({
      sessionId: sessions.id,
      userId: users.id,
      role: users.role,
      status: users.status,
      countryCode: users.countryCode,
      locale: users.locale,
      email: users.email,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now)
      )
    )
    .limit(1);

  if (!row || row.status !== "active") return null;

  await renewSessionIfApplicable(row.sessionId, row.role, now);

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    role: row.role,
    countryCode: row.countryCode,
    locale: row.locale,
    email: row.email,
  };
}

/** 6.1: skyver `expires_at` frem til `now + 30 dager` for mottaker/journalist
 * ved hver gyldig bruk (glidende vindu). Setter `last_used_at` for ALLE
 * roller (ren informasjon/revisjon), men skyver bevisst IKKE `expires_at`
 * for moderator/administrator — 6.3 nevner ingen fornyelse for dem, og
 * `createSession()`s faste 12-timers levetid skal derfor stå uendret. */
async function renewSessionIfApplicable(
  sessionId: string,
  role: SessionRole,
  now: Date
): Promise<void> {
  if (role === "recipient" || role === "journalist") {
    await db
      .update(sessions)
      .set({
        expiresAt: new Date(now.getTime() + RECIPIENT_JOURNALIST_SESSION_MS),
        lastUsedAt: now,
      })
      .where(eq(sessions.id, sessionId));
  } else {
    await db.update(sessions).set({ lastUsedAt: now }).where(eq(sessions.id, sessionId));
  }
}

/** Logger ut — tilbakekaller økten i databasen (ikke bare cookien lokalt),
 * slik at en stjålet token ikke lenger virker etter utlogging. */
export async function revokeCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (rawToken) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.tokenHash, hashToken(rawToken)));
  }

  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Tilbakekaller ALLE økter for en bruker, uavhengig av enhet/cookie — brukes
 * ved kontosletting (SPEC-V1.md 17.5: "aktive økter avsluttes"), ikke bare
 * den innloggede klientens egen. `isNull(sessions.revokedAt)` gjør dette
 * idempotent å kalle flere ganger.
 */
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
