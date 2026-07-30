// Ren funksjon, ingen andre importer (se src/lib/http/safe-redirect.ts for
// hvorfor). FR-021: "Systemet skal avvise draft → submitted dersom et
// obligatorisk felt i 9.1 mangler, med feilmelding per felt." — denne
// funksjonen ER den feilmeldingen-per-felt-logikken.

export interface RequestFieldsForSubmit {
  title: string | null;
  summary: string | null;
  description: string | null;
  targetPersonDescription: string | null;
  responseDeadline: Date | null;
  allowsAnonymousParticipation: boolean | null;
  mayBeRecorded: boolean | null;
  mayInvolvePhotoVideo: boolean | null;
}

// Grensene fra SPEC-V1.md 9.1.
export const FIELD_LIMITS = {
  title: 120,
  summary: 300,
  description: 5000,
  targetPersonDescription: 500,
} as const;

const MIN_DEADLINE_MS = 24 * 60 * 60 * 1000; // minst 24 timer frem
const MAX_DEADLINE_MS = 90 * 24 * 60 * 60 * 1000; // maks 90 dager frem

export type SubmitValidationError =
  | "title_required"
  | "title_too_long"
  | "summary_required"
  | "summary_too_long"
  | "description_required"
  | "description_too_long"
  | "target_person_description_required"
  | "target_person_description_too_long"
  | "response_deadline_required"
  | "response_deadline_too_soon"
  | "response_deadline_too_far"
  | "allows_anonymous_participation_required"
  | "may_be_recorded_required"
  | "may_involve_photo_video_required";

/**
 * Full validering for `draft/changes_requested → submitted` (FR-021).
 * Returnerer én feilkode per manglende/ugyldig felt — aldri bare "noe
 * mangler".
 */
export function validateForSubmit(
  fields: RequestFieldsForSubmit,
  now: Date = new Date()
): SubmitValidationError[] {
  const errors: SubmitValidationError[] = [];

  if (!fields.title) errors.push("title_required");
  else if (fields.title.length > FIELD_LIMITS.title) errors.push("title_too_long");

  if (!fields.summary) errors.push("summary_required");
  else if (fields.summary.length > FIELD_LIMITS.summary) errors.push("summary_too_long");

  if (!fields.description) errors.push("description_required");
  else if (fields.description.length > FIELD_LIMITS.description) errors.push("description_too_long");

  if (!fields.targetPersonDescription) errors.push("target_person_description_required");
  else if (fields.targetPersonDescription.length > FIELD_LIMITS.targetPersonDescription) {
    errors.push("target_person_description_too_long");
  }

  if (!fields.responseDeadline) {
    errors.push("response_deadline_required");
  } else {
    const diff = fields.responseDeadline.getTime() - now.getTime();
    if (diff < MIN_DEADLINE_MS) errors.push("response_deadline_too_soon");
    if (diff > MAX_DEADLINE_MS) errors.push("response_deadline_too_far");
  }

  if (fields.allowsAnonymousParticipation === null) {
    errors.push("allows_anonymous_participation_required");
  }
  if (fields.mayBeRecorded === null) errors.push("may_be_recorded_required");
  if (fields.mayInvolvePhotoVideo === null) errors.push("may_involve_photo_video_required");

  return errors;
}

/**
 * Lettere sjekk brukt ved HVER lagring av utkast (ikke bare innsending) —
 * håndhever lengdegrenser og fristvindu på felter som FAKTISK er oppgitt,
 * uten å kreve at alle er utfylt. Et utkast skal kunne være ufullstendig,
 * men ikke ugyldig der det faktisk har innhold.
 */
export function validatePatchedFields(
  fields: Partial<RequestFieldsForSubmit>,
  now: Date = new Date()
): SubmitValidationError[] {
  const errors: SubmitValidationError[] = [];

  if (fields.title !== undefined && fields.title !== null && fields.title.length > FIELD_LIMITS.title) {
    errors.push("title_too_long");
  }
  if (
    fields.summary !== undefined &&
    fields.summary !== null &&
    fields.summary.length > FIELD_LIMITS.summary
  ) {
    errors.push("summary_too_long");
  }
  if (
    fields.description !== undefined &&
    fields.description !== null &&
    fields.description.length > FIELD_LIMITS.description
  ) {
    errors.push("description_too_long");
  }
  if (
    fields.targetPersonDescription !== undefined &&
    fields.targetPersonDescription !== null &&
    fields.targetPersonDescription.length > FIELD_LIMITS.targetPersonDescription
  ) {
    errors.push("target_person_description_too_long");
  }
  if (fields.responseDeadline !== undefined && fields.responseDeadline !== null) {
    const diff = fields.responseDeadline.getTime() - now.getTime();
    if (diff < MIN_DEADLINE_MS) errors.push("response_deadline_too_soon");
    if (diff > MAX_DEADLINE_MS) errors.push("response_deadline_too_far");
  }

  return errors;
}
