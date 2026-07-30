import { and, count, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db/client";
import {
  contactRequests,
  countries,
  journalistProfiles,
  moderatorCountries,
  requests,
  responses,
  users,
} from "@/db/schema";
import { sendTransactionalEmail } from "@/lib/email/send";
import { slugify, withDisambiguator } from "./slug";
import { validateForSubmit, validatePatchedFields, type SubmitValidationError } from "./validate";

const MAX_CONCURRENT_PUBLISHED = 5; // FR-029, SPEC-V1.md 9.2

export interface RequestPatchInput {
  title?: string;
  summary?: string;
  description?: string;
  targetPersonDescription?: string;
  topic?: string | null;
  geographicNote?: string | null;
  internalReference?: string | null;
  responseDeadline?: Date;
  allowsAnonymousParticipation?: boolean;
  mayBeRecorded?: boolean;
  mayInvolvePhotoVideo?: boolean;
  contentLanguage?: string;
}

export type RequestActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: SubmitValidationError[] };

async function findOwnedEditable(requestId: string, journalistUserId: string) {
  const [row] = await db
    .select()
    .from(requests)
    .where(and(eq(requests.id, requestId), eq(requests.journalistId, journalistUserId)))
    .limit(1);
  return row ?? null;
}

/**
 * FR-010: journalisten kan opprette et utkast uten at noe felt er utfylt.
 * Land og innholdsspråk hentes fra journalistens egen konto (`country_code`
 * kopieres bevisst, SPEC-V1.md 19.6 — senere endring av journalistens
 * marked skal ikke flytte historiske forespørsler).
 */
export async function createDraft(journalistUserId: string): Promise<RequestActionResult> {
  const [journalist] = await db
    .select({ countryCode: users.countryCode, role: users.role })
    .from(users)
    .where(eq(users.id, journalistUserId))
    .limit(1);

  if (!journalist || journalist.role !== "journalist") {
    return { ok: false, error: "errors.not_authorized" };
  }

  const [country] = await db
    .select({ defaultLocale: countries.defaultLocale })
    .from(countries)
    .where(eq(countries.code, journalist.countryCode))
    .limit(1);
  if (!country) return { ok: false, error: "errors.invalid_country" };

  const [created] = await db
    .insert(requests)
    .values({
      journalistId: journalistUserId,
      countryCode: journalist.countryCode,
      contentLanguage: country.defaultLocale,
      status: "draft",
      // De øvrige feltene er nullable (økt 6-rettelsen i SPEC-V1.md 19.6) og
      // settes via updateDraft().
    })
    .returning({ id: requests.id });

  if (!created) return { ok: false, error: "errors.generic" };
  return { ok: true, id: created.id };
}

/**
 * PATCH — kun `draft` og `changes_requested` (SPEC-V1.md 20). Genererer
 * slug første gang tittel finnes; regenererer IKKE etter publisering
 * (håndheves av at denne funksjonen selv nekter å kjøre utenfor de to
 * redigerbare statusene).
 */
export async function updateDraft(
  requestId: string,
  journalistUserId: string,
  patch: RequestPatchInput
): Promise<RequestActionResult> {
  const existing = await findOwnedEditable(requestId, journalistUserId);
  if (!existing) return { ok: false, error: "errors.not_found" };
  if (existing.status !== "draft" && existing.status !== "changes_requested") {
    return { ok: false, error: "errors.request_not_editable" };
  }

  if (patch.contentLanguage) {
    const [country] = await db
      .select({ availableLocales: countries.availableLocales })
      .from(countries)
      .where(eq(countries.code, existing.countryCode))
      .limit(1);
    if (!country || !country.availableLocales.includes(patch.contentLanguage)) {
      return { ok: false, error: "errors.invalid_locale" };
    }
  }

  const fieldErrors = validatePatchedFields(
    {
      title: patch.title,
      summary: patch.summary,
      description: patch.description,
      targetPersonDescription: patch.targetPersonDescription,
      responseDeadline: patch.responseDeadline,
    },
    new Date()
  );
  if (fieldErrors.length > 0) {
    return { ok: false, error: "errors.validation_failed", fieldErrors };
  }

  let slug = existing.slug;
  const effectiveTitle = patch.title ?? existing.title;
  if (!slug && effectiveTitle) {
    slug = await generateUniqueSlug(effectiveTitle);
  }

  await db
    .update(requests)
    .set({ ...patch, slug, updatedAt: new Date() })
    .where(eq(requests.id, requestId));

  return { ok: true, id: requestId };
}

async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || "foresporsel";
  let candidate = base;
  let attempt = 2;

  while (true) {
    const [existing] = await db
      .select({ id: requests.id })
      .from(requests)
      .where(eq(requests.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
    candidate = withDisambiguator(base, attempt);
    attempt += 1;
  }
}

/**
 * `draft | changes_requested → submitted` (FR-011/FR-021). Krever
 * `verification_status = approved` (FR-005, 8.1) og håndhever
 * samtidighetsgrensen (FR-029, maks 5 `published`).
 */
export async function submitRequest(
  requestId: string,
  journalistUserId: string
): Promise<RequestActionResult> {
  const existing = await findOwnedEditable(requestId, journalistUserId);
  if (!existing) return { ok: false, error: "errors.not_found" };
  if (existing.status !== "draft" && existing.status !== "changes_requested") {
    return { ok: false, error: "errors.request_not_editable" };
  }

  const [journalist] = await db
    .select({
      status: users.status,
      verificationStatus: journalistProfiles.verificationStatus,
      locale: users.locale,
      email: users.email,
    })
    .from(users)
    .innerJoin(journalistProfiles, eq(journalistProfiles.userId, users.id))
    .where(eq(users.id, journalistUserId))
    .limit(1);

  if (!journalist || journalist.status !== "active" || journalist.verificationStatus !== "approved") {
    return { ok: false, error: "errors.not_authorized" };
  }

  const fieldErrors = validateForSubmit(
    {
      title: existing.title,
      summary: existing.summary,
      description: existing.description,
      targetPersonDescription: existing.targetPersonDescription,
      responseDeadline: existing.responseDeadline,
      allowsAnonymousParticipation: existing.allowsAnonymousParticipation,
      mayBeRecorded: existing.mayBeRecorded,
      mayInvolvePhotoVideo: existing.mayInvolvePhotoVideo,
    },
    new Date()
  );
  if (fieldErrors.length > 0) {
    return { ok: false, error: "errors.validation_failed", fieldErrors };
  }

  // FR-029: maks 5 samtidig PUBLISERTE. Sjekket her ved submit OG re-sjekket
  // ved faktisk publisering (src/lib/moderation/requests.ts,
  // publishRequest()) — to sjekker, ikke fordi den ene er nok, men fordi
  // tiden mellom submit og moderatorgodkjenning gjør at flere innsendte
  // forespørsler i prinsippet kunne bli godkjent omtrent samtidig og bryte
  // grensen hvis bare denne fantes.
  const [publishedRow] = await db
    .select({ value: count() })
    .from(requests)
    .where(and(eq(requests.journalistId, journalistUserId), eq(requests.status, "published")));

  if ((publishedRow?.value ?? 0) >= MAX_CONCURRENT_PUBLISHED) {
    return { ok: false, error: "errors.too_many_published_requests" };
  }

  await db
    .update(requests)
    .set({ status: "submitted", updatedAt: new Date() })
    .where(eq(requests.id, requestId));

  // Varsle moderatorer tildelt landet (SPEC-V1.md 15: "Ny forespørsel til
  // moderering | moderator").
  const moderators = await db
    .select({ email: users.email, locale: users.locale })
    .from(moderatorCountries)
    .innerJoin(users, eq(users.id, moderatorCountries.moderatorUserId))
    .where(eq(moderatorCountries.countryCode, existing.countryCode));

  for (const moderator of moderators) {
    await sendTransactionalEmail({
      template: "new_request_for_moderation",
      to: { email: moderator.email, locale: moderator.locale },
      data: { requestId },
    });
  }

  return { ok: true, id: requestId };
}

/**
 * `published → closed` (9.2). Journalisten som eier forespørselen, ELLER en
 * moderator/administrator kan lukke — se 6.3/6.4.
 */
export async function closeRequest(
  requestId: string,
  actorUserId: string
): Promise<RequestActionResult> {
  const [existing] = await db.select().from(requests).where(eq(requests.id, requestId)).limit(1);
  if (!existing) return { ok: false, error: "errors.not_found" };
  if (existing.status !== "published") return { ok: false, error: "errors.request_not_open" };

  const isOwner = existing.journalistId === actorUserId;
  if (!isOwner) {
    const [actor] = await db.select({ role: users.role }).from(users).where(eq(users.id, actorUserId)).limit(1);
    if (!actor || (actor.role !== "moderator" && actor.role !== "admin")) {
      return { ok: false, error: "errors.not_authorized" };
    }
  }

  await db
    .update(requests)
    .set({ status: "closed", closedAt: new Date(), updatedAt: new Date() })
    .where(eq(requests.id, requestId));

  // 14.3: pending kontaktforespørsler skal utløpe "når forespørselen
  // lukkes", ikke bare etter 14 dager. Manglet frem til nå — lagt til her
  // (økt 7, se NATTLOGG.md) fremfor i den daglige tikkejobben, siden
  // lukking er en øyeblikkelig hendelse, ikke noe et 15-minutters-vindu
  // skal oppdage i etterkant.
  const responseIdsForRequest = db
    .select({ id: responses.id })
    .from(responses)
    .where(eq(responses.requestId, requestId));

  await db
    .update(contactRequests)
    .set({ status: "expired" })
    .where(
      and(
        eq(contactRequests.status, "pending"),
        inArray(contactRequests.responseId, responseIdsForRequest)
      )
    );

  return { ok: true, id: requestId };
}

/**
 * Soft delete — kun FØR publisering (`draft | changes_requested | rejected
 * → deleted`, 9.2/20).
 */
export async function deleteDraft(
  requestId: string,
  journalistUserId: string
): Promise<RequestActionResult> {
  const existing = await findOwnedEditable(requestId, journalistUserId);
  if (!existing) return { ok: false, error: "errors.not_found" };
  if (!["draft", "changes_requested", "rejected"].includes(existing.status)) {
    return { ok: false, error: "errors.request_not_editable" };
  }

  await db
    .update(requests)
    .set({ status: "deleted", updatedAt: new Date() })
    .where(eq(requests.id, requestId));

  return { ok: true, id: requestId };
}

export async function listMineRequests(journalistUserId: string) {
  return db
    .select()
    .from(requests)
    .where(and(eq(requests.journalistId, journalistUserId), ne(requests.status, "deleted")));
}

/** Eierens egen detaljvisning — i motsetning til getPublicRequest() krever
 * denne ingen bestemt status, bare eierskap. Brukes av GET /requests/:id
 * når kalleren er den innloggede journalisten som eier raden. */
export async function getOwnedRequestDetail(requestId: string, journalistUserId: string) {
  const [row] = await db
    .select()
    .from(requests)
    .where(
      and(
        eq(requests.id, requestId),
        eq(requests.journalistId, journalistUserId),
        ne(requests.status, "deleted")
      )
    )
    .limit(1);
  return row ?? null;
}

const PUBLICLY_VISIBLE_STATUSES = ["published", "closed", "expired"] as const;

/** 11: publiserte, lukkede og utløpte forespørsler er offentlig lesbare —
 * alt annet (inkl. `rejected`, som aldri var offentlig) er skjult. */
export async function getPublicRequest(requestId: string) {
  const [row] = await db
    .select({
      id: requests.id,
      slug: requests.slug,
      title: requests.title,
      summary: requests.summary,
      description: requests.description,
      targetPersonDescription: requests.targetPersonDescription,
      status: requests.status,
      responseDeadline: requests.responseDeadline,
      geographicNote: requests.geographicNote,
      allowsAnonymousParticipation: requests.allowsAnonymousParticipation,
      mayBeRecorded: requests.mayBeRecorded,
      mayInvolvePhotoVideo: requests.mayInvolvePhotoVideo,
      contentLanguage: requests.contentLanguage,
      publishedAt: requests.publishedAt,
      organizationName: journalistProfiles.organizationName,
      journalistFullName: journalistProfiles.fullName,
    })
    .from(requests)
    .innerJoin(journalistProfiles, eq(requests.journalistId, journalistProfiles.userId))
    .where(
      and(
        eq(requests.id, requestId),
        inArray(requests.status, [...PUBLICLY_VISIBLE_STATUSES])
      )
    )
    .limit(1);

  return row ?? null;
}
