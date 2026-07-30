import "server-only";
import { cookies } from "next/headers";
import { eq, and, isNull, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { generateToken, hashToken } from "./tokens";

// Øktlevetid fra SPEC-V1.md 8.1/8.3 — se også 19.15.
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
 * `verify`. Fornyer IKKE en eksisterende økt — 8.3 sier eksplisitt at
 * moderator/administrator-økter ikke fornyes automatisk, og for enkelhets
 * skyld gjelder samme "ingen stille fornyelse"-prinsipp for alle roller her:
 * en ny økt opprettes bare ved ny innlogging. */
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
 * uhell" — svarskjemaet (12) trenger å vise nettopp dette. */
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

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    role: row.role,
    countryCode: row.countryCode,
    locale: row.locale,
    email: row.email,
  };
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
