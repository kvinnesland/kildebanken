import { db } from "@/db/client";
import { users, authTokens } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { generateToken, hashToken } from "./tokens";
import { sendTransactionalEmail } from "@/lib/email/send";
import { resolveSenderIdentity } from "@/lib/email/sender-identity";
import { checkRateLimit } from "@/lib/security/rate-limit";

// SPEC-V1.md 6.1: 15 minutters gyldighet, engangsbruk, maks 5 forespørsler
// per e-postadresse per 15 minutter (samme seksjon + INFRASTRUCTURE.md 18).
const TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Ber om en innloggingslenke. Avslører ALDRI om e-postadressen faktisk
 * finnes i systemet — kalleren (route handler) skal alltid returnere samme
 * generiske suksessmelding uansett hva denne funksjonen faktisk gjorde.
 *
 * Tolkning tatt under autonomt arbeid (se NATTLOGG.md, økt 2): SPEC-V1.md 15
 * lister "Bekreft e-postadresse" og "Innloggingslenke" som to ulike maler,
 * men 6.1 sier eksplisitt at "e-postadressen verifiseres som en del av
 * innloggingen" — altså samme mekanisme. Jeg har derfor IKKE bygget en egen
 * bekreftelsesflyt: første forespørsel etter registrering (når
 * `email_verified_at` ennå er tom) bruker malen "confirm_email" (mottaker)
 * eller "journalist_application_received" (journalist — kombinerer
 * bekreftelse og søknadskvittering i én e-post, økt 3), alle senere bruker
 * "magic_link". Samme `AuthToken`, samme `verifyMagicLink()`.
 */
export async function requestMagicLink(email: string): Promise<void> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) return;
  if (user.status === "suspended" || user.status === "deleted") return;

  // Bruker den delte, allerede atomisk-sikrede checkRateLimit()
  // (security/rate-limit.ts, samme mønster som createDraft() i
  // src/lib/requests/requests.ts) i stedet for en egen "SELECT COUNT så
  // INSERT" her — den forrige, hånd-rullede varianten var et REELT kappløp:
  // mange samtidige forespørsler for SAMME e-postadresse kunne alle lese
  // samme (for lave) antall og alle bestå 5-grensen (SPEC-V1.md 6.1), siden
  // ingen per-bucket advisory-lås serialiserte dem (se checkRateLimit() sin
  // egen kommentar, task #42, for hvorfor det trengs).
  const allowed = await checkRateLimit(db, `magic-link:${user.id}`, RATE_LIMIT_WINDOW_MS, MAX_REQUESTS_PER_WINDOW);
  if (!allowed) return;

  const rawToken = generateToken();
  await db.insert(authTokens).values({
    userId: user.id,
    tokenHash: hashToken(rawToken),
    purpose: "login",
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });

  const firstEmailTemplate =
    user.role === "journalist" ? "journalist_application_received" : "confirm_email";

  // SPEC-V1.md 10.4 — se resolveSenderIdentity() sin egen kommentar.
  const identity = await resolveSenderIdentity(user.countryCode, user.locale);

  await sendTransactionalEmail({
    template: user.emailVerifiedAt ? "magic_link" : firstEmailTemplate,
    to: { email: user.email, locale: user.locale },
    data: { token: rawToken },
    senderName: identity?.senderName,
    replyTo: identity?.replyTo,
    countryDefaultLocale: identity?.countryDefaultLocale,
  });
}

export interface VerifiedUser {
  userId: string;
  role: "recipient" | "journalist" | "moderator" | "admin";
  locale: string;
}

/**
 * Verifiserer et engangstoken. Utløpt og allerede brukt behandles likt som
 * "ugyldig" — samme prinsipp som Session (19.15): ikke to ulike feilveier
 * for tilstander som begge betyr "dette virker ikke lenger".
 */
export async function verifyMagicLink(rawToken: string): Promise<VerifiedUser | null> {
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const [row] = await db
    .select({
      tokenId: authTokens.id,
      usedAt: authTokens.usedAt,
      expiresAt: authTokens.expiresAt,
      purpose: authTokens.purpose,
      userId: users.id,
      role: users.role,
      status: users.status,
      emailVerifiedAt: users.emailVerifiedAt,
      locale: users.locale,
    })
    .from(authTokens)
    .innerJoin(users, eq(authTokens.userId, users.id))
    .where(eq(authTokens.tokenHash, tokenHash))
    .limit(1);

  if (!row) return null;
  if (row.purpose !== "login") return null; // feil formål brukt på feil endepunkt
  if (row.usedAt) return null;
  if (row.expiresAt < now) return null;
  if (row.status === "suspended" || row.status === "deleted") return null;

  // isNull(usedAt) i selve UPDATE-en (ikke bare sjekken over) gjør
  // "engangsbruk" atomisk — uten den kunne to samtidige forsøk på å
  // verifisere SAMME token (f.eks. en e-postsikkerhetsskanner som
  // forhåndsbesøker lenker, et velkjent, reelt fenomen for
  // engangsinnloggingslenker) begge passere sjekken før noen rakk å skrive,
  // og begge få en gyldig innlogging fra et token som skal kunne brukes
  // NØYAKTIG én gang.
  const [claimed] = await db
    .update(authTokens)
    .set({ usedAt: now })
    .where(and(eq(authTokens.id, row.tokenId), isNull(authTokens.usedAt)))
    .returning({ id: authTokens.id });
  if (!claimed) return null;

  if (!row.emailVerifiedAt || row.status === "pending_email_verification") {
    await db
      .update(users)
      .set({ emailVerifiedAt: row.emailVerifiedAt ?? now, status: "active" })
      .where(eq(users.id, row.userId));
  }

  return { userId: row.userId, role: row.role, locale: row.locale };
}
