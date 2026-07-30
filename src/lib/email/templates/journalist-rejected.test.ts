import { describe, expect, it } from "vitest";
import { renderJournalistRejectedEmail } from "./journalist-rejected";

describe("renderJournalistRejectedEmail", () => {
  it("inneholder riktig emnefelt og overskrift", () => {
    const rendered = renderJournalistRejectedEmail("nb-NO", "Ugyldig redaksjonstilknytning");
    expect(rendered.subject).toBe("Journalistsøknaden din er avvist");
    expect(rendered.html).toContain("Journalistsøknaden din er avvist");
  });

  it("setter moderatorens fritekst-begrunnelse inn i teksten, uoversatt", () => {
    const rendered = renderJournalistRejectedEmail("nb-NO", "Ugyldig redaksjonstilknytning");
    expect(rendered.html).toContain("Ugyldig redaksjonstilknytning");
    expect(rendered.text).toContain("Ugyldig redaksjonstilknytning");
  });

  it("har ingen CTA-knapp — en avvist søknad har ingen oppfølgingshandling", () => {
    const rendered = renderJournalistRejectedEmail("nb-NO", "reason");
    expect(rendered.html).not.toContain("<a href=");
  });

  it("rendrer på engelsk når locale er en-GB", () => {
    const rendered = renderJournalistRejectedEmail("en-GB", "Could not verify newsroom affiliation");
    expect(rendered.subject).toBe("Your journalist application has been rejected");
    expect(rendered.html).toContain("Could not verify newsroom affiliation");
  });
});
