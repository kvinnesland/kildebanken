import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLogs,
  authTokens,
  contactRequests,
  emailSubscriptions,
  requests,
  responses,
  users,
} from "@/db/schema";
import { generateToken, hashToken } from "./tokens";
import { revokeAllSessionsForUser } from "./session";
import { sendTransactionalEmail } from "@/lib/email/send";
import { resolveSenderIdentity } from "@/lib/email/sender-identity";

// Samme gyldighetstid som magic link (6.1) — se src/lib/auth/magic-link.ts.
const TOKEN_TTL_MS = 15 * 60 * 1000;

export type AccountDeletionResult = { ok: true } | { ok: false; error: string };

/**
 * Steg 1 av 2 (18.2: eget bekreftelsestoken for sensitive, irreversible
 * handlinger). Sender en egen bekreftelseslenke — IKKE den vanlige
 * innloggingslenken, se begrunnelse i SPEC-V1.md 15. Avslører aldri om
 * brukeren finnes; kalleren (route) returnerer alltid samme generiske svar,
 * samme prinsipp som `requestMagicLink`.
 */
export async function requestAccountDeletion(userId: string): Promise<void> {
  const [user] = await db
    .select({
      email: users.email,
      locale: users.locale,
      status: users.status,
      countryCode: users.countryCode,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.status === "deleted") return;

  const rawToken = generateToken();
  await db.insert(authTokens).values({
    userId,
    tokenHash: hashToken(rawToken),
    purpose: "delete_account",
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });

  // SPEC-V1.md 10.4 — se resolveSenderIdentity() sin egen kommentar.
  const identity = await resolveSenderIdentity(user.countryCode, user.locale);

  await sendTransactionalEmail({
    template: "confirm_account_deletion",
    to: { email: user.email, locale: user.locale },
    data: { token: rawToken },
    senderName: identity?.senderName,
    replyTo: identity?.replyTo,
    countryDefaultLocale: identity?.countryDefaultLocale,
  });
}

/**
 * Steg 2 av 2. Verifiserer engangstokenet (samme mønster som
 * `verifyMagicLink` — utløpt og allerede brukt behandles likt), gjennomfører
 * deretter selve slettingen (SPEC-V1.md 17.5).
 */
export async function confirmAccountDeletion(rawToken: string): Promise<AccountDeletionResult> {
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
    })
    .from(authTokens)
    .innerJoin(users, eq(authTokens.userId, users.id))
    .where(eq(authTokens.tokenHash, tokenHash))
    .limit(1);

  if (!row || row.purpose !== "delete_account") return { ok: false, error: "errors.not_found" };
  if (row.usedAt) return { ok: false, error: "errors.not_found" };
  if (row.expiresAt < now) return { ok: false, error: "errors.not_found" };
  if (row.status === "deleted") return { ok: false, error: "errors.not_found" };

  // Samme atomiske engangsbruk-lukking som verifyMagicLink()
  // (src/lib/auth/magic-link.ts) — uten isNull(usedAt) i selve UPDATE-en
  // kunne to samtidige forsøk på å bekrefte SAMME slettelenke begge passere
  // sjekken over og begge trigge performAccountDeletion(), en irreversibel
  // handling (18.2).
  const [claimed] = await db
    .update(authTokens)
    .set({ usedAt: now })
    .where(and(eq(authTokens.id, row.tokenId), isNull(authTokens.usedAt)))
    .returning({ id: authTokens.id });
  if (!claimed) return { ok: false, error: "errors.not_found" };

  await performAccountDeletion(row.userId, row.role);

  return { ok: true };
}

/**
 * Selve slettelogikken, eksportert (natt til 2026-08-01, se NATTLOGG.md) slik
 * at `adminDeleteUser()` i src/lib/moderation/users.ts kan kalle NØYAKTIG
 * samme funksjon som den selvbetjente tokenflyten over — ikke en egen
 * kopi. `actorUserId` er valgfri og faller tilbake til `userId` selv
 * (selvbetjent sletting, uendret atferd for `confirmAccountDeletion()` under);
 * en moderator-utløst sletting sender inn SIN EGEN økt-ID i stedet, slik at
 * revisjonsloggen (19.12) viser hvem som faktisk tok beslutningen, ikke bare
 * hvem kontoen tilhørte.
 */
export async function performAccountDeletion(
  userId: string,
  role: "recipient" | "journalist" | "moderator" | "admin",
  actorUserId: string = userId
): Promise<void> {
  const [user] = await db
    .select({ email: users.email, locale: users.locale, countryCode: users.countryCode })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return;

  // Atomisk "krav" på selve slettingen, FØR noe annet gjøres — 18.2, samme
  // prinsipp som `confirmAccountDeletion()` sin engangsbruk-lukking over.
  // `confirmAccountDeletion()` er selv trygg (tokenet kan bare brukes én
  // gang), men `adminDeleteUser()` (src/lib/moderation/users.ts) har INGEN
  // slik atomisk sperre — bare en tidligere, ikke-atomisk sjekk av
  // `status !== "deleted"`. To nesten samtidige
  // `POST /admin/users/:id/delete`-kall for SAMME bruker (dobbeltklikk, eller
  // en nettverksgjenforsøk) kunne derfor begge passere den sjekken og begge
  // kjøre HELE denne funksjonen — duplikate e-poster til brukeren selv, til
  // journalister/respondenter, OG (hvis det andre kallets SELECT over skjedde
  // ETTER det første kallets skriving her) et forsøk på å hashe en allerede
  // hashet "e-post", som ville korrumpert `email_hash`. `WHERE status !=
  // 'deleted'` gjør at bare ett av de to kallene faktisk fullfører — det
  // andre får `affected.length === 0` og avbryter umiddelbart, uten
  // bivirkninger. Beregner `emailHash` fra den FERSKE `user.email` lest over,
  // ikke fra en potensielt allerede anonymisert verdi.
  const emailHash = hashToken(user.email);
  const claimed = await db
    .update(users)
    .set({ email: emailHash, emailHash, displayName: null, status: "deleted", deletedAt: new Date() })
    .where(and(eq(users.id, userId), ne(users.status, "deleted")))
    .returning({ id: users.id });
  if (claimed.length === 0) return;

  // Sendes FØR anonymisering — bruker den ekte adressen fanget i `user`
  // over, ikke et nytt oppslag (users-raden er allerede anonymisert av
  // skrivingen over). SPEC-V1.md 10.4 — se resolveSenderIdentity() sin
  // egen kommentar.
  const identity = await resolveSenderIdentity(user.countryCode, user.locale);

  await sendTransactionalEmail({
    template: "account_deletion_confirmed",
    to: { email: user.email, locale: user.locale },
    data: {},
    senderName: identity?.senderName,
    replyTo: identity?.replyTo,
    countryDefaultLocale: identity?.countryDefaultLocale,
  });

  await revokeAllSessionsForUser(userId);

  await db
    .update(emailSubscriptions)
    .set({ status: "unsubscribed", unsubscribedAt: new Date() })
    .where(eq(emailSubscriptions.userId, userId));

  if (role === "recipient") {
    await anonymizeRecipientContent(userId);
  } else if (role === "journalist") {
    await closeJournalistContentOnDeletion(userId);
  }

  await db.insert(auditLogs).values({
    actorType: "user",
    actorUserId,
    action: "account.delete",
    entityType: "user",
    entityId: userId,
  });
}

/**
 * SPEC-V1.md 17.5: "innsendte svar anonymiseres – respondent_id beholdes
 * som referanse til den anonymiserte kontoen, delt e-postadresse fjernes,
 * svarteksten beholdes til den ordinære retensjonsfristen løper ut." Svaret
 * SLETTES IKKE her — bare koblingen til identitet fjernes. Dette er bevisst
 * forskjellig fra `withdrawResponse()` (hard-slettes umiddelbart) — to ulike
 * hendelser med to ulike, spec-definerte utfall.
 */
async function anonymizeRecipientContent(respondentUserId: string): Promise<void> {
  await db
    .update(responses)
    .set({ contactSharing: "none", displayNameSnapshot: null })
    .where(and(eq(responses.respondentId, respondentUserId), eq(responses.lifecycleStatus, "submitted")));

  // 17.5: "delt e-postadresse fjernes" — en allerede GODKJENT
  // kontaktforespørsel er ferdigbehandlet (kanselleres ikke, i motsetning
  // til pending under), men den faktiske adressen den lagret ved
  // godkjenning (respondToContactRequest()) skal ikke bli stående i
  // klartekst etter at kontoen er anonymisert. Reelt hull frem til nå —
  // ingen tidligere test dekket dette, kun den ventende-kanselleres-
  // banen under (se NATTLOGG.md).
  const approvedContactRequestIds = db
    .select({ id: contactRequests.id })
    .from(contactRequests)
    .innerJoin(responses, eq(contactRequests.responseId, responses.id))
    .where(and(eq(responses.respondentId, respondentUserId), eq(contactRequests.status, "approved")));

  await db
    .update(contactRequests)
    .set({ sharedEmail: null })
    .where(inArray(contactRequests.id, approvedContactRequestIds));

  const pendingContactRequests = await db
    .select({ id: contactRequests.id, journalistId: contactRequests.journalistId })
    .from(contactRequests)
    .innerJoin(responses, eq(contactRequests.responseId, responses.id))
    .where(and(eq(responses.respondentId, respondentUserId), eq(contactRequests.status, "pending")));

  for (const cr of pendingContactRequests) {
    // `updatedAt` settes eksplisitt — se contact-requests.ts sin egen
    // kommentar (retention.ts's purgeOldContactRequests() er avhengig av
    // dette).
    await db
      .update(contactRequests)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(contactRequests.id, cr.id));

    const [journalist] = await db
      .select({ email: users.email, locale: users.locale, countryCode: users.countryCode })
      .from(users)
      .where(eq(users.id, cr.journalistId))
      .limit(1);
    if (journalist) {
      // SPEC-V1.md 10.4 — se resolveSenderIdentity() sin egen kommentar.
      const identity = await resolveSenderIdentity(journalist.countryCode, journalist.locale);
      await sendTransactionalEmail({
        template: "contact_request_cancelled_account_deleted",
        to: { email: journalist.email, locale: journalist.locale },
        data: {},
        senderName: identity?.senderName,
        replyTo: identity?.replyTo,
        countryDefaultLocale: identity?.countryDefaultLocale,
      });
    }
  }
}

/**
 * SPEC-V1.md 17.5, siste avsnitt: "Slettes en journalistkonto, lukkes åpne
 * forespørsler, respondentene varsles, og svarene følger den ordinære
 * retensjonsfristen." Ingen anonymisering av `JournalistProfile` (fullName
 * m.fl.) er spesifisert — antagelse tatt her (se NATTLOGG.md, økt 7): navn
 * og redaksjon blir stående på allerede publiserte forespørsler, samme
 * begrunnelse som at en avis beholder en byline selv om journalisten slutter.
 */
async function closeJournalistContentOnDeletion(journalistUserId: string): Promise<void> {
  const openRequests = await db
    .select({ id: requests.id, title: requests.title, slug: requests.slug })
    .from(requests)
    .where(and(eq(requests.journalistId, journalistUserId), eq(requests.status, "published")));

  for (const r of openRequests) {
    await db
      .update(requests)
      .set({ status: "closed", closedAt: new Date() })
      .where(eq(requests.id, r.id));

    // 14.3: pending kontaktforespørsler skal utløpe "når forespørselen
    // lukkes" — også når lukkingen skjer via kontosletting, ikke bare via
    // closeRequest() (src/lib/requests/requests.ts). Manglet her frem til
    // nå, et reelt hull mellom to steder som begge lukker en forespørsel
    // (rettet samme økt som `request_closed`, se NATTLOGG.md).
    const responseIdsForRequest = db
      .select({ id: responses.id })
      .from(responses)
      .where(eq(responses.requestId, r.id));

    // `updatedAt` settes eksplisitt — se contact-requests.ts sin egen
    // kommentar (retention.ts's purgeOldContactRequests() er avhengig av
    // dette).
    await db
      .update(contactRequests)
      .set({ status: "expired", updatedAt: new Date() })
      .where(
        and(eq(contactRequests.status, "pending"), inArray(contactRequests.responseId, responseIdsForRequest))
      );

    const respondents = await db
      .select({ email: users.email, locale: users.locale, countryCode: users.countryCode })
      .from(responses)
      .innerJoin(users, eq(responses.respondentId, users.id))
      .where(and(eq(responses.requestId, r.id), eq(responses.lifecycleStatus, "submitted")));

    for (const respondent of respondents) {
      // SPEC-V1.md 10.4 — se resolveSenderIdentity() sin egen kommentar.
      const identity = await resolveSenderIdentity(respondent.countryCode, respondent.locale);
      await sendTransactionalEmail({
        template: "response_request_closed",
        to: { email: respondent.email, locale: respondent.locale },
        data: { requestId: r.id, title: r.title, slug: r.slug },
        senderName: identity?.senderName,
        replyTo: identity?.replyTo,
        countryDefaultLocale: identity?.countryDefaultLocale,
      });
    }
  }
}
