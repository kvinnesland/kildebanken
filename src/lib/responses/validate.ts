// Ren funksjon, ingen andre importer — se mønsteret i
// src/lib/http/safe-redirect.ts. FR-030 og SPEC-V1.md 12.1.

export const RESPONSE_FIELD_LIMITS = {
  relevanceStatement: 2000,
  answerText: 4000,
  shortBio: 500,
  displayName: 80,
} as const;

export interface ResponseSubmissionInput {
  relevanceStatement: string;
  answerText: string;
  shortBio?: string | null;
  displayName?: string | null;
  contactSharing: "none" | "email";
}

export type ResponseValidationError =
  | "relevance_statement_required"
  | "relevance_statement_too_long"
  | "answer_text_required"
  | "answer_text_too_long"
  | "short_bio_too_long"
  | "display_name_too_long";

export function validateResponseSubmission(
  input: ResponseSubmissionInput
): ResponseValidationError[] {
  const errors: ResponseValidationError[] = [];

  if (!input.relevanceStatement.trim()) errors.push("relevance_statement_required");
  else if (input.relevanceStatement.length > RESPONSE_FIELD_LIMITS.relevanceStatement) {
    errors.push("relevance_statement_too_long");
  }

  if (!input.answerText.trim()) errors.push("answer_text_required");
  else if (input.answerText.length > RESPONSE_FIELD_LIMITS.answerText) {
    errors.push("answer_text_too_long");
  }

  if (input.shortBio && input.shortBio.length > RESPONSE_FIELD_LIMITS.shortBio) {
    errors.push("short_bio_too_long");
  }

  if (input.displayName && input.displayName.length > RESPONSE_FIELD_LIMITS.displayName) {
    errors.push("display_name_too_long");
  }

  return errors;
}
