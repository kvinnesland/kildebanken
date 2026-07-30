import { describe, expect, it } from "vitest";
import { validateForSubmit, validatePatchedFields, type RequestFieldsForSubmit } from "./validate";

const NOW = new Date("2026-07-30T12:00:00Z");
const VALID_DEADLINE = new Date("2026-08-15T12:00:00Z"); // 16 dager frem

const completeFields: RequestFieldsForSubmit = {
  title: "Søker personer som har byttet karriere",
  summary: "Kort oppsummering.",
  description: "Full beskrivelse av saken.",
  targetPersonDescription: "Personer i 30-årene som har byttet bransje.",
  responseDeadline: VALID_DEADLINE,
  allowsAnonymousParticipation: true,
  mayBeRecorded: false,
  mayInvolvePhotoVideo: false,
};

describe("validateForSubmit", () => {
  it("gir ingen feil for et komplett, gyldig sett med felter", () => {
    expect(validateForSubmit(completeFields, NOW)).toEqual([]);
  });

  it("flagger hvert manglende obligatorisk felt separat, ikke bare ett", () => {
    const empty: RequestFieldsForSubmit = {
      title: null,
      summary: null,
      description: null,
      targetPersonDescription: null,
      responseDeadline: null,
      allowsAnonymousParticipation: null,
      mayBeRecorded: null,
      mayInvolvePhotoVideo: null,
    };
    const errors = validateForSubmit(empty, NOW);

    expect(errors).toContain("title_required");
    expect(errors).toContain("summary_required");
    expect(errors).toContain("description_required");
    expect(errors).toContain("target_person_description_required");
    expect(errors).toContain("response_deadline_required");
    expect(errors).toContain("allows_anonymous_participation_required");
    expect(errors).toContain("may_be_recorded_required");
    expect(errors).toContain("may_involve_photo_video_required");
    expect(errors.length).toBe(8);
  });

  it("avviser tittel over 120 tegn", () => {
    const errors = validateForSubmit({ ...completeFields, title: "x".repeat(121) }, NOW);
    expect(errors).toContain("title_too_long");
  });

  it("godtar tittel på nøyaktig 120 tegn", () => {
    const errors = validateForSubmit({ ...completeFields, title: "x".repeat(120) }, NOW);
    expect(errors).not.toContain("title_too_long");
  });

  it("avviser frist under 24 timer frem", () => {
    const tooSoon = new Date(NOW.getTime() + 60 * 60 * 1000); // 1 time
    const errors = validateForSubmit({ ...completeFields, responseDeadline: tooSoon }, NOW);
    expect(errors).toContain("response_deadline_too_soon");
  });

  it("avviser frist mer enn 90 dager frem", () => {
    const tooFar = new Date(NOW.getTime() + 91 * 24 * 60 * 60 * 1000);
    const errors = validateForSubmit({ ...completeFields, responseDeadline: tooFar }, NOW);
    expect(errors).toContain("response_deadline_too_far");
  });

  it("godtar frist på nøyaktig 24 timer frem", () => {
    const exact = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    const errors = validateForSubmit({ ...completeFields, responseDeadline: exact }, NOW);
    expect(errors).not.toContain("response_deadline_too_soon");
  });

  it("behandler `false` som gyldig svar, ikke som manglende (viktig!)", () => {
    // Dette er selve poenget med at feltene er boolean|null, ikke
    // boolean med default false — false MÅ telle som besvart.
    const errors = validateForSubmit(
      { ...completeFields, allowsAnonymousParticipation: false, mayBeRecorded: false, mayInvolvePhotoVideo: false },
      NOW
    );
    expect(errors).not.toContain("allows_anonymous_participation_required");
    expect(errors).not.toContain("may_be_recorded_required");
    expect(errors).not.toContain("may_involve_photo_video_required");
  });
});

describe("validatePatchedFields", () => {
  it("gir ingen feil når ingen felter er oppgitt", () => {
    expect(validatePatchedFields({}, NOW)).toEqual([]);
  });

  it("håndhever lengdegrense på et felt som ER oppgitt, selv i utkast", () => {
    const errors = validatePatchedFields({ summary: "x".repeat(301) }, NOW);
    expect(errors).toContain("summary_too_long");
  });

  it("krever IKKE at andre felter er utfylt", () => {
    const errors = validatePatchedFields({ title: "En tittel" }, NOW);
    expect(errors).toEqual([]);
  });

  it("håndhever fristvindu når frist er oppgitt i et utkast", () => {
    const tooFar = new Date(NOW.getTime() + 200 * 24 * 60 * 60 * 1000);
    const errors = validatePatchedFields({ responseDeadline: tooFar }, NOW);
    expect(errors).toContain("response_deadline_too_far");
  });
});
