import { and, count, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLogs,
  contactRequests,
  countries,
  journalistProfiles,
  moderatorCountries,
  requests,
  responses,
  users,
} from "@/db/schema";
import { isUniqueViolation } from "@/db/errors";
import { sendTransactionalEmail } from "@/lib/email/send";
import { zonedWallTimeToUtc } from "@/lib/datetime/timezone";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { slugify, withDisambiguator } from "./slug";
import { validateForSubmit, validatePatchedFields, type SubmitValidationError } from "./validate";

const MAX_CONCURRENT_PUBLISHED = 5; // FR-029, SPEC-V1.md 9.2

// SPEC-V1.md 18: "20 forespørselsopprettelser per journalist per døgn."
const CREATE_DRAFT_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const CREATE_DRAFT_RATE_LIMIT_MAX = 20;

export interface RequestPatchInput {
  title?: string;
  summary?: string;
  description?: string;
  targetPersonDescription?: string;
  topic?: string | null;
  geographicNote?: string | null;
  internalReference?: string | null;
  // To alternative veier til det samme feltet: `responseDeadline` er det
  // faktiske UTC-tidspunktet, for kallere som allerede har regnet det ut
  // (bl.a. integrasjonstestene). `responseDeadlineLocal` er rå
  // `YYYY-MM-DDTHH:mm` fra en `<input type="datetime-local">` — SPEC-V1.md
  // 9.1 krever at journalisten taster dette i LANDETS tidssone, ikke sin
  // egen nettlesers, så konverteringen må skje her (der landets tidssone
  // allerede slås opp), ikke i skjemaet.
  responseDeadline?: Date;
  responseDeadlineLocal?: string;
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

  const allowed = await checkRateLimit(
    db,
    `request:${journalistUserId}`,
    CREATE_DRAFT_RATE_LIMIT_WINDOW_MS,
    CREATE_DRAFT_RATE_LIMIT_MAX
  );
  if (!allowed) return { ok: false, error: "errors.rate_limited" };

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

  let resolvedDeadline = patch.responseDeadline;

  if (patch.contentLanguage || patch.responseDeadlineLocal) {
    const [country] = await db
      .select({ availableLocales: countries.availableLocales, timezone: countries.timezone })
      .from(countries)
      .where(eq(countries.code, existing.countryCode))
      .limit(1);
    if (!country) return { ok: false, error: "errors.invalid_country" };

    if (patch.contentLanguage && !country.availableLocales.includes(patch.contentLanguage)) {
      return { ok: false, error: "errors.invalid_locale" };
    }
    if (patch.responseDeadlineLocal) {
      resolvedDeadline = zonedWallTimeToUtc(patch.responseDeadlineLocal, country.timezone);
    }
  }

  const fieldErrors = validatePatchedFields(
    {
      title: patch.title,
      summary: patch.summary,
      description: patch.description,
      targetPersonDescription: patch.targetPersonDescription,
      responseDeadline: resolvedDeadline,
    },
    new Date()
  );
  if (fieldErrors.length > 0) {
    return { ok: false, error: "errors.validation_failed", fieldErrors };
  }

  let slug = existing.slug;
  const effectiveTitle = patch.title ?? existing.title;
  const generatingNewSlug = !slug && !!effectiveTitle;
  if (generatingNewSlug) {
    slug = await generateUniqueSlug(effectiveTitle!);
  }

  const { responseDeadlineLocal: _omit, ...rest } = patch;

  // Sjekk-så-skriv på en unik kolonne (requests_slug_idx) — samme bug-klasse
  // som createCountry() i src/lib/admin/countries.ts (se NATTLOGG.md): to
  // journalister som lagrer et utkast med samme/lignende tittel omtrent
  // samtidig kunne begge få samme kandidat fra generateUniqueSlug() før noen
  // av dem rakk å skrive. I motsetning til createCountry() er "avvis med en
  // feilmelding" upassende her — brukeren har ikke gjort noe galt, de skrev
  // bare en tittel — så i stedet for å returnere errors.already_exists,
  // genereres en NY kandidat og skrivingen forsøkes på nytt.
  const MAX_SLUG_ATTEMPTS = 10;
  for (let attempt = 1; ; attempt++) {
    try {
      await db
        .update(requests)
        .set({ ...rest, responseDeadline: resolvedDeadline, slug, updatedAt: new Date() })
        .where(eq(requests.id, requestId));
      break;
    } catch (err) {
      if (generatingNewSlug && isUniqueViolation(err) && attempt < MAX_SLUG_ATTEMPTS) {
        // Bevisst IKKE generateUniqueSlug() på nytt her: den skanner
        // deterministisk fra samme startpunkt (base, base-2, base-3, …)
        // hver gang, så flere samtidige tapere ville konvergert mot NØYAKTIG
        // samme neste kandidat og fortsatt kollidert med hverandre —
        // O(antall samtidige skrivinger) runder for å løse seg helt opp.
        // Et tilfeldig startpunkt for selve gjenopprettingsforsøket sprer
        // taperne fra hverandre, slik at nesten alle løses i én ekstra
        // runde uansett hvor mange som kolliderte samtidig.
        slug = await generateUniqueSlugFrom(effectiveTitle!, 2 + Math.floor(Math.random() * 1000));
        continue;
      }
      throw err;
    }
  }

  return { ok: true, id: requestId };
}

async function generateUniqueSlug(title: string): Promise<string> {
  return generateUniqueSlugFrom(title, 2);
}

async function generateUniqueSlugFrom(title: string, startAttempt: number): Promise<string> {
  const base = slugify(title) || "foresporsel";
  let candidate = base;
  let attempt = startAttempt;

  // Den ALLERFØRSTE kandidaten er bare selve basen uten suffiks — det
  // gjelder også ved en race-gjenoppretting med et tilfeldig startpunkt >
  // 2, siden basen kan ha blitt ledig igjen (usannsynlig, men billig å
  // sjekke) og alltid er den peneste kandidaten om den er ledig.
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
      data: { requestId, title: existing.title },
    });
  }

  return { ok: true, id: requestId };
}

/**
 * `published → closed` (9.2). Journalisten som eier forespørselen, ELLER en
 * moderator/administrator kan lukke — se 6.3/6.4. Brukes av BÅDE
 * `POST /requests/:id/close` (eier) og `POST /admin/requests/:id/close`
 * (moderator/administrator) — samme underliggende operasjon, to ruter, som
 * resten av modereringsflytene i denne filen.
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
    if (!actor) return { ok: false, error: "errors.not_authorized" };

    if (actor.role === "moderator") {
      // 4: "en moderator er tildelt ett eller flere land og ser bare køer og
      // brukere tilhørende disse" — rettet her (økt 7, se NATTLOGG.md), et
      // ekte hull der EN HVILKEN SOM HELST moderator, uavhengig av tildelt
      // land, tidligere kunne lukke enhver forespørsel.
      const [assignment] = await db
        .select({ countryCode: moderatorCountries.countryCode })
        .from(moderatorCountries)
        .where(
          and(
            eq(moderatorCountries.moderatorUserId, actorUserId),
            eq(moderatorCountries.countryCode, existing.countryCode)
          )
        )
        .limit(1);
      if (!assignment) return { ok: false, error: "errors.not_authorized" };
    } else if (actor.role !== "admin") {
      return { ok: false, error: "errors.not_authorized" };
    }

    // FR-050: "logge ALLE moderator- og administratorhandlinger ... med
    // land." Manglet her frem til nå — et reelt hull, ikke bare i denne
    // funksjonen (se NATTLOGG.md, økt 7, for de andre stedene samme hull ble
    // funnet). Logges KUN når det faktisk ER en moderator/administrator som
    // handler — journalistens egen lukking av sin egen forespørsel er ikke
    // en "moderator-/administratorhandling".
    await db.insert(auditLogs).values({
      actorType: "user",
      actorUserId,
      countryCode: existing.countryCode,
      action: "request.close",
      entityType: "request",
      entityId: requestId,
    });
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

  // SPEC-V1.md 15: "Forespørsel lukket | journalist" — manglet helt frem
  // til nå (null kallere noe sted i kodebasen). Sendes uansett hvem som
  // lukket den (journalisten selv eller moderator/administrator), siden
  // spec-raden ikke skiller mellom disse.
  const [journalist] = await db
    .select({ email: users.email, locale: users.locale })
    .from(users)
    .where(eq(users.id, existing.journalistId))
    .limit(1);
  if (journalist) {
    await sendTransactionalEmail({
      template: "request_closed",
      to: { email: journalist.email, locale: journalist.locale },
      data: { requestId, title: existing.title },
    });
  }

  // SPEC-V1.md 15: "Forespørsel du har svart på er lukket | mottaker" —
  // samme rad som request_closed over, men til RESPONDENTEN, ikke
  // journalisten. Manglet her frem til nå — malen (response_request_closed)
  // fantes og var allerede koblet inn i closeJournalistContentOnDeletion()
  // (src/lib/auth/account-deletion.ts, 17.5), men den er en HELT ANNEN,
  // mye sjeldnere lukkevei enn denne funksjonen (journalistens/moderatorens
  // vanlige lukking) — spec-raden skiller ikke mellom lukkeårsak, så
  // respondenter skal varsles uansett hvilken vei som faktisk lukket den.
  // Samme spørring/løkke-mønster som account-deletion.ts sin funksjon.
  const respondents = await db
    .select({ email: users.email, locale: users.locale })
    .from(responses)
    .innerJoin(users, eq(responses.respondentId, users.id))
    .where(and(eq(responses.requestId, requestId), eq(responses.lifecycleStatus, "submitted")));

  for (const respondent of respondents) {
    await sendTransactionalEmail({
      template: "response_request_closed",
      to: { email: respondent.email, locale: respondent.locale },
      data: { requestId, title: existing.title, slug: existing.slug },
    });
  }

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

/**
 * Brukes av redigeringssiden (`/[locale]/journalist/requests/[id]`) til å
 * bygge språkvelgeren og tolke `responseDeadlineLocal` — landet er allerede
 * fastlåst fra journalistens konto (9.1: "kan ikke velges i skjemaet"), så
 * dette er bare et oppslag, ikke et valg.
 */
export async function getCountryFormOptions(
  countryCode: string
): Promise<{ availableLocales: string[]; timezone: string } | null> {
  const [country] = await db
    .select({ availableLocales: countries.availableLocales, timezone: countries.timezone })
    .from(countries)
    .where(eq(countries.code, countryCode))
    .limit(1);
  return country ?? null;
}

const PUBLICLY_VISIBLE_STATUSES = ["published", "closed", "expired"] as const;

/** 11: publiserte, lukkede og utløpte forespørsler er offentlig lesbare —
 * alt annet (inkl. `rejected`, som aldri var offentlig) er skjult.
 *
 * Filtrerer også på at eierens `User.status = active` — 8.1: "Ved suspensjon
 * skjules journalistens publiserte forespørsler umiddelbart." Dette er en
 * SYNLIGHETSREGEL, ikke en tilstandsendring på selve forespørselen (bevisst
 * IKKE det samme som `closeRequest()`) — reverseres derfor automatisk når
 * suspensjonen oppheves, uten noen egen "vis igjen"-handling.
 */
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
      // SPEC-V1.md 11: "svarfrist MED TIDSSONE" — landets IANA-tidssone, ikke
      // leserens egen, se countries.timezone (19.1).
      countryCode: requests.countryCode,
      countryTimezone: countries.timezone,
      // Til hreflang-alternater i generateMetadata (11: "hreflang-
      // alternater") — landets faktiske tilgjengelige locales, ikke en
      // hardkodet liste, slik at det skalerer automatisk når land nummer to
      // (med flere locales) legges til.
      countryAvailableLocales: countries.availableLocales,
    })
    .from(requests)
    .innerJoin(journalistProfiles, eq(requests.journalistId, journalistProfiles.userId))
    .innerJoin(users, eq(requests.journalistId, users.id))
    .innerJoin(countries, eq(requests.countryCode, countries.code))
    .where(
      and(
        eq(requests.id, requestId),
        inArray(requests.status, [...PUBLICLY_VISIBLE_STATUSES]),
        eq(users.status, "active")
      )
    )
    .limit(1);

  return row ?? null;
}
