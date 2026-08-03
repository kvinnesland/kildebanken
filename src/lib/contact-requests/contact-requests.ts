import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, contactRequests, journalistProfiles, requests, responses, users } from "@/db/schema";
import { sendTransactionalEmail } from "@/lib/email/send";
import { resolveSenderIdentity } from "@/lib/email/sender-identity";
import { isUniqueViolation } from "@/db/errors";

const EXPIRES_AFTER_MS = 14 * 24 * 60 * 60 * 1000; // 14 dager, SPEC-V1.md 14.2
const MESSAGE_MAX_LENGTH = 1000; // 14.1

export type ContactRequestActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * FR-040, SPEC-V1.md 14.1. Kun journalisten som eier forespørselen svaret
 * gjelder, og kun dersom respondenten ikke allerede har delt e-postadressen.
 * "Én kontaktforespørsel per svar" (FR-043) håndheves av den unike indeksen
 * på `contact_requests.response_id` (19.8) — sjekken her er bare en
 * vennligere feilvei.
 */
export async function createContactRequest(
  responseId: string,
  journalistUserId: string,
  input: { message: string; requestedContactMethod: string }
): Promise<ContactRequestActionResult> {
  if (!input.message.trim() || input.message.length > MESSAGE_MAX_LENGTH) {
    return { ok: false, error: "errors.validation_failed" };
  }

  const [response] = await db
    .select({
      id: responses.id,
      lifecycleStatus: responses.lifecycleStatus,
      contactSharing: responses.contactSharing,
      requestJournalistId: requests.journalistId,
      requestTitle: requests.title,
      journalistName: journalistProfiles.fullName,
      organizationName: journalistProfiles.organizationName,
    })
    .from(responses)
    .innerJoin(requests, eq(responses.requestId, requests.id))
    .innerJoin(journalistProfiles, eq(requests.journalistId, journalistProfiles.userId))
    .where(eq(responses.id, responseId))
    .limit(1);

  if (!response) return { ok: false, error: "errors.not_found" };
  if (response.requestJournalistId !== journalistUserId) {
    return { ok: false, error: "errors.not_authorized" };
  }
  if (response.lifecycleStatus !== "submitted") {
    return { ok: false, error: "errors.not_found" };
  }
  if (response.contactSharing === "email") {
    // Adressen er allerede delt sammen med svaret — ingen kontaktforespørsel
    // å sende (14.1: "Har respondenten ikke delt e-postadressen, kan
    // journalisten sende...").
    return { ok: false, error: "errors.contact_already_shared" };
  }

  try {
    const [created] = await db
      .insert(contactRequests)
      .values({
        responseId,
        journalistId: journalistUserId,
        message: input.message,
        requestedContactMethod: input.requestedContactMethod,
        status: "pending",
        expiresAt: new Date(Date.now() + EXPIRES_AFTER_MS),
      })
      .returning({ id: contactRequests.id });

    if (!created) return { ok: false, error: "errors.generic" };

    const [respondent] = await db
      .select({ email: users.email, locale: users.locale, countryCode: users.countryCode })
      .from(users)
      .innerJoin(responses, eq(responses.respondentId, users.id))
      .where(eq(responses.id, responseId))
      .limit(1);

    if (respondent) {
      // SPEC-V1.md 10.4 — se resolveSenderIdentity() sin egen kommentar.
      const identity = await resolveSenderIdentity(respondent.countryCode, respondent.locale);
      await sendTransactionalEmail({
        template: "contact_request_received",
        to: { email: respondent.email, locale: respondent.locale },
        data: {
          contactRequestId: created.id,
          requestTitle: response.requestTitle ?? "",
          journalistName: response.journalistName,
          organizationName: response.organizationName,
        },
        senderName: identity?.senderName,
        replyTo: identity?.replyTo,
      });
    }

    return { ok: true, id: created.id };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "errors.contact_request_already_sent" };
    }
    throw err;
  }
}

/**
 * FR-041, SPEC-V1.md 14.2/14.3. Kun respondenten svaret tilhører kan svare,
 * og kun mens forespørselen fortsatt er `pending` (utløpt/kansellert/allerede
 * besvart gir samme feilmelding — ingen grunn til å skille dem for brukeren).
 *
 * `expiresAt` sjekkes DIREKTE her, i tillegg til `status` — `status` flippes
 * til `expired` av `runExpireContactRequests()` (tick.ts), som kun kjører
 * periodisk (hvert 15. minutt), så en forespørsel kan reelt være forbi sin
 * 14-dagersfrist uten at status har rukket å bli oppdatert ennå. I motsetning
 * til påminnelsesjobbenes tilsvarende TOCTOU-avveining (bevisst akseptert,
 * se NATTLOGG.md) koster denne sjekken ingenting ekstra — feltet er allerede
 * hentet i samme rad — så her lukkes vinduet i stedet for å aksepteres.
 */
export async function respondToContactRequest(
  contactRequestId: string,
  respondentUserId: string,
  decision: "approved" | "declined"
): Promise<ContactRequestActionResult> {
  const [contactRequest] = await db
    .select({
      id: contactRequests.id,
      status: contactRequests.status,
      expiresAt: contactRequests.expiresAt,
      journalistId: contactRequests.journalistId,
      responseRespondentId: responses.respondentId,
    })
    .from(contactRequests)
    .innerJoin(responses, eq(contactRequests.responseId, responses.id))
    .where(eq(contactRequests.id, contactRequestId))
    .limit(1);

  if (!contactRequest || contactRequest.responseRespondentId !== respondentUserId) {
    return { ok: false, error: "errors.not_found" };
  }

  const now = new Date();

  if (contactRequest.status !== "pending" || contactRequest.expiresAt < now) {
    return { ok: false, error: "errors.contact_request_not_pending" };
  }

  if (decision === "approved") {
    const [respondent] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, respondentUserId))
      .limit(1);
    if (!respondent) return { ok: false, error: "errors.generic" };

    // WHERE-betingelsen på status="pending" lukker TOCTOU-vinduet mellom
    // sjekken over og denne skrivingen: uten den kan et konkurrerende kall
    // (samme respondent avslår i en annen fane samtidig, eller trekker
    // svaret — se withdrawResponse i responses.ts) ha rukket å endre status
    // i mellomtiden, og denne skrivingen ville da blindt overskrevet det med
    // e-post og revisjonslogg basert på en utdatert lesing.
    // `updatedAt` settes eksplisitt her (og ved alle andre overganger vekk
    // fra `pending`, se de tilsvarende stedene i responses.ts, tick.ts,
    // requests.ts og account-deletion.ts) — SPEC-V1.md 17.4 sin
    // "kontaktforespørsel: 12 måneder ETTER AVSLUTNING" håndheves av
    // purgeOldContactRequests() (retention.ts) via nettopp `updatedAt`, og
    // dens egen kommentar HEVDER at "raden alltid oppdateres idet den
    // forlater pending" — men INGEN overgang satte den faktisk, noe
    // som ville gjort retensjonsvinduet ~14 dager for kort (kolonnen
    // ville aldri endret seg fra innsettingstidspunktet, se NATTLOGG.md).
    // Reelt hull, rettet her.
    const [updated] = await db
      .update(contactRequests)
      .set({ status: "approved", sharedEmail: respondent.email, respondedAt: now, updatedAt: now })
      .where(and(eq(contactRequests.id, contactRequestId), eq(contactRequests.status, "pending")))
      .returning({ id: contactRequests.id });
    if (!updated) return { ok: false, error: "errors.contact_request_not_pending" };

    // 14.3: "All deling av kontaktopplysninger logges i revisjonsloggen med
    // tidspunkt, hvilken journalist som fikk tilgang og hvilket samtykke
    // som lå til grunn." `reason` bærer samtykkegrunnlaget, `metadata`
    // bevisst UTEN selve e-postadressen (19.12: aldri unødvendige
    // personopplysninger i metadata).
    await db.insert(auditLogs).values({
      actorType: "user",
      actorUserId: respondentUserId,
      action: "contact_request.approve",
      entityType: "contact_request",
      entityId: contactRequestId,
      reason: "respondent_approved_contact_request",
    });

    const [journalist] = await db
      .select({ email: users.email, locale: users.locale, countryCode: users.countryCode })
      .from(users)
      .where(eq(users.id, contactRequest.journalistId))
      .limit(1);
    if (journalist) {
      // SPEC-V1.md 10.4 — se resolveSenderIdentity() sin egen kommentar.
      const identity = await resolveSenderIdentity(journalist.countryCode, journalist.locale);
      await sendTransactionalEmail({
        template: "contact_approved",
        to: { email: journalist.email, locale: journalist.locale },
        data: { contactRequestId },
        senderName: identity?.senderName,
        replyTo: identity?.replyTo,
      });
    }
  } else {
    // Samme TOCTOU-lukking som i approved-grenen over.
    const [updated] = await db
      .update(contactRequests)
      .set({ status: "declined", respondedAt: now, updatedAt: now })
      .where(and(eq(contactRequests.id, contactRequestId), eq(contactRequests.status, "pending")))
      .returning({ id: contactRequests.id });
    if (!updated) return { ok: false, error: "errors.contact_request_not_pending" };

    const [journalist] = await db
      .select({ email: users.email, locale: users.locale, countryCode: users.countryCode })
      .from(users)
      .where(eq(users.id, contactRequest.journalistId))
      .limit(1);
    if (journalist) {
      // "Ved avslag varsles journalisten uten begrunnelse" (14.2) — ingen
      // `reason`-data sendes med. SPEC-V1.md 10.4 — se
      // resolveSenderIdentity() sin egen kommentar.
      const identity = await resolveSenderIdentity(journalist.countryCode, journalist.locale);
      await sendTransactionalEmail({
        template: "contact_declined",
        to: { email: journalist.email, locale: journalist.locale },
        data: { contactRequestId },
        senderName: identity?.senderName,
        replyTo: identity?.replyTo,
      });
    }
  }

  return { ok: true, id: contactRequestId };
}

export async function getContactRequestDetail(contactRequestId: string, userId: string) {
  const [row] = await db
    .select({
      id: contactRequests.id,
      status: contactRequests.status,
      message: contactRequests.message,
      requestedContactMethod: contactRequests.requestedContactMethod,
      sharedEmail: contactRequests.sharedEmail,
      expiresAt: contactRequests.expiresAt,
      respondedAt: contactRequests.respondedAt,
      journalistId: contactRequests.journalistId,
      respondentId: responses.respondentId,
    })
    .from(contactRequests)
    .innerJoin(responses, eq(contactRequests.responseId, responses.id))
    .where(eq(contactRequests.id, contactRequestId))
    .limit(1);

  if (!row) return null;
  // Bare de to involverte partene kan se den — journalisten som sendte den,
  // eller respondenten den gjelder.
  if (row.journalistId !== userId && row.respondentId !== userId) return null;

  // Respondenten skal aldri se sin egen delte e-postadresse tilbake fra
  // dette endepunktet som om det var en nyhet — feltet er uansett det de
  // selv oppga. Ufarlig å inkludere, men fjernes for journalisten dersom
  // status ikke er `approved` (skal ikke kunne "gjette seg til" at den er
  // satt før godkjenning).
  if (row.journalistId === userId && row.status !== "approved") {
    return { ...row, sharedEmail: null };
  }

  return row;
}
