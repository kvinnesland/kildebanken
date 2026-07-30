import { describe, expect, it } from "vitest";
import { validateResponseSubmission, type ResponseSubmissionInput } from "./validate";

const valid: ResponseSubmissionInput = {
  relevanceStatement: "Jeg har selv gått gjennom dette.",
  answerText: "Her er svaret mitt på spørsmålet.",
  shortBio: "Kort om meg.",
  displayName: "Kari",
  contactSharing: "none",
};

describe("validateResponseSubmission", () => {
  it("gir ingen feil for et gyldig svar", () => {
    expect(validateResponseSubmission(valid)).toEqual([]);
  });

  it("krever relevanceStatement", () => {
    expect(validateResponseSubmission({ ...valid, relevanceStatement: "" })).toContain(
      "relevance_statement_required"
    );
    expect(validateResponseSubmission({ ...valid, relevanceStatement: "   " })).toContain(
      "relevance_statement_required"
    );
  });

  it("krever answerText", () => {
    expect(validateResponseSubmission({ ...valid, answerText: "" })).toContain(
      "answer_text_required"
    );
  });

  it("håndhever 2000-tegnsgrensen på relevanceStatement", () => {
    expect(
      validateResponseSubmission({ ...valid, relevanceStatement: "x".repeat(2001) })
    ).toContain("relevance_statement_too_long");
    expect(
      validateResponseSubmission({ ...valid, relevanceStatement: "x".repeat(2000) })
    ).not.toContain("relevance_statement_too_long");
  });

  it("håndhever 4000-tegnsgrensen på answerText", () => {
    expect(validateResponseSubmission({ ...valid, answerText: "x".repeat(4001) })).toContain(
      "answer_text_too_long"
    );
  });

  it("kortPresentasjon og visningsnavn er valgfrie, men har lengdegrenser", () => {
    expect(validateResponseSubmission({ ...valid, shortBio: null })).toEqual([]);
    expect(validateResponseSubmission({ ...valid, shortBio: "x".repeat(501) })).toContain(
      "short_bio_too_long"
    );
    expect(validateResponseSubmission({ ...valid, displayName: "x".repeat(81) })).toContain(
      "display_name_too_long"
    );
  });
});
