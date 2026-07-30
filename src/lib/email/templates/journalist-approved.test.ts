import { describe, expect, it } from "vitest";
import { renderJournalistApprovedEmail } from "./journalist-approved";

describe("renderJournalistApprovedEmail", () => {
  it("inneholder riktig emnefelt og overskrift", () => {
    const rendered = renderJournalistApprovedEmail("nb-NO");
    expect(rendered.subject).toBe("Journalistkontoen din er godkjent");
    expect(rendered.html).toContain("Journalistkontoen din er godkjent");
  });

  it("lenken peker på innloggingssiden, ikke et token-basert verify-endepunkt", () => {
    const rendered = renderJournalistApprovedEmail("nb-NO");
    expect(rendered.html).toContain("/nb-NO/logg-inn");
  });

  it("rendrer på engelsk når locale er en-GB", () => {
    const rendered = renderJournalistApprovedEmail("en-GB");
    expect(rendered.subject).toBe("Your journalist account has been approved");
    expect(rendered.html).toContain("/en-GB/logg-inn");
  });
});
