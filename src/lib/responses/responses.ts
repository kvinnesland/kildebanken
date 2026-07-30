import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contactRequests, journalistProfiles, requests, responses, users } from "@/db/schema";
import { sendTransactionalEmail } from "@/lib/email/send";
import { isUniqueViolation } from "@/db/errors";
import { validateResponseSubmission, type ResponseSubmissionInput } from "./validate";

export type ResponseActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * FR-030/FR-041, SPEC-V1.md 12. Krever en verifisert mottakerkonto og at
 * forespørselen fortsatt er `published` — den unike, betingede indeksen fra
 * `src/db/migrations/0001_responses_active_unique_index.sql` er den
 * egentlige garantien mot dobbeltsvar (FR-041); sjekken her er bare en
 * vennligere feilvei enn en rå constraint-feil.
 */
export async function submitResponse(
  requestId: string,
  respondentUserId: string,
  input: ResponseSubmissionInput
): Promise<ResponseActionResult> {
  const [respondent] = await db
    .select({ status: users.status, role: users.role, locale: users.locale, email: users.email })
    .from(users)
    .where(eq(users.id, respondentUserId))
    .limit(1);

  if (!respondent || respondent.role !== "recipient" || respondent.status !== "active") {
    return { ok: false, error: "errors.not_authorized" };
  }

  const [request] = await db
    .select({
      status: requests.status,
      journalistId: requests.journalistId,
      title: requests.title,
      slug: requests.slug,
    })
    .from(requests)
    .where(eq(requests.id, requestId))
    .limit(1);

  if (!request) return { ok: false, error: "errors.not_found" };
  if (request.status !== "published") return { ok: false, error: "errors.request_not_open" };

  const fieldErrors = validateResponseSubmission(input);
  if (fieldErrors.length > 0) {
    return { ok: false, error: "errors.validation_failed" };
  }

  try {
    const [created] = await db
      .insert(responses)
      .values({
        requestId,
        respondentId: respondentUserId,
        displayNameSnapshot: input.displayName ?? null,
        relevanceStatement: input.relevanceStatement,
        answerText: input.answerText,
        shortBio: input.shortBio ?? null,
        contactSharing: input.contactSharing,
        lifecycleStatus: "submitted",
        submittedAt: new Date(),
      })
      .returning({ id: responses.id });

    if (!created) return { ok: false, error: "errors.generic" };

    await sendTransactionalEmail({
      template: "response_submitted_receipt",
      to: { email: respondent.email, locale: respondent.locale },
      data: { requestId, requestTitle: request.title, requestSlug: request.slug },
    });

    // SPEC-V1.md 20.1 nevner at journalisten varsles "dersom journalisten
    // har valgt umiddelbare varsler" — en preferanse som ikke er modellert
    // ennå. Sender ubetinget inntil videre; se NATTLOGG.md.
    const [journalist] = await db
      .select({ email: users.email, locale: users.locale })
      .from(users)
      .where(eq(users.id, request.journalistId))
      .limit(1);
    if (journalist) {
      await sendTransactionalEmail({
        template: "new_response_received",
        to: { email: journalist.email, locale: journalist.locale },
        data: { requestId, requestTitle: request.title, requestSlug: request.slug },
      });
    }

    return { ok: true, id: created.id };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "errors.already_responded" };
    }
    throw err;
  }
}

/**
 * FR-033, SPEC-V1.md 12.4: "Respondenten kan trekke svaret så lenge
 * forespørselen er åpen." 17.4: "Trukket svar: Slettes umiddelbart" — svaret
 * hard-slettes her og nå, ikke merkes og ryddes senere av retention-jobben.
 * Åpne kontaktforespørsler kanselleres; allerede avgjorte beholder sin
 * status, men mister koblingen til det slettede svaret (19.8, rettet
 * økt 6).
 */
export async function withdrawResponse(
  responseId: string,
  respondentUserId: string
): Promise<ResponseActionResult> {
  const [response] = await db
    .select({ id: responses.id, requestId: responses.requestId, respondentId: responses.respondentId })
    .from(responses)
    .where(and(eq(responses.id, responseId), eq(responses.respondentId, respondentUserId)))
    .limit(1);

  if (!response) return { ok: false, error: "errors.not_found" };

  const [request] = await db
    .select({ status: requests.status })
    .from(requests)
    .where(eq(requests.id, response.requestId))
    .limit(1);

  if (!request || request.status !== "published") {
    return { ok: false, error: "errors.request_not_open" };
  }

  // Kanseller pending kontaktforespørsler, og sever koblingen for ALLE
  // (uansett status) siden svaret uansett slettes rett under.
  await db
    .update(contactRequests)
    .set({ status: "cancelled" })
    .where(and(eq(contactRequests.responseId, responseId), eq(contactRequests.status, "pending")));

  await db
    .update(contactRequests)
    .set({ responseId: null })
    .where(eq(contactRequests.responseId, responseId));

  await db.delete(responses).where(eq(responses.id, responseId));

  return { ok: true, id: responseId };
}

export async function getRespondentView(responseId: string, respondentUserId: string) {
  const [row] = await db
    .select({
      id: responses.id,
      requestId: responses.requestId,
      lifecycleStatus: responses.lifecycleStatus,
      submittedAt: responses.submittedAt,
      viewedAt: responses.viewedAt,
      contactSharing: responses.contactSharing,
      requestTitle: requests.title,
      organizationName: journalistProfiles.organizationName,
    })
    .from(responses)
    .innerJoin(requests, eq(responses.requestId, requests.id))
    .innerJoin(journalistProfiles, eq(requests.journalistId, journalistProfiles.userId))
    .where(and(eq(responses.id, responseId), eq(responses.respondentId, respondentUserId)))
    .limit(1);

  return row ?? null;
}

/**
 * GET /responses/mine (SPEC-V1.md 20). Kun statuser med reell verdi for
 * respondenten (17): trukne svar finnes ikke lenger i det hele tatt
 * (hard-slettet, se withdrawResponse over), så denne lister uansett bare
 * det som fortsatt eksisterer.
 */
export async function listMineResponses(respondentUserId: string) {
  return db
    .select({
      id: responses.id,
      requestId: responses.requestId,
      requestTitle: requests.title,
      lifecycleStatus: responses.lifecycleStatus,
      submittedAt: responses.submittedAt,
      viewedAt: responses.viewedAt,
      contactSharing: responses.contactSharing,
      organizationName: journalistProfiles.organizationName,
    })
    .from(responses)
    .innerJoin(requests, eq(responses.requestId, requests.id))
    .innerJoin(journalistProfiles, eq(requests.journalistId, journalistProfiles.userId))
    .where(eq(responses.respondentId, respondentUserId));
}
