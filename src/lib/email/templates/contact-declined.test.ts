import { describe, expect, it } from "vitest";
import { renderContactDeclinedEmail } from "./contact-declined";

describe("renderContactDeclinedEmail", () => {
  it("inneholder riktig emnefelt og overskrift", () => {
    const rendered = renderContactDeclinedEmail("nb-NO");
    expect(rendered.subject).toBe("Kontakt avslått");
    expect(rendered.html).toContain("Kontakt avslått");
  });

  it("har ingen CTA-knapp — ingenting igjen å gjøre noe med, og ingen begrunnelse (14.2, ordrett)", () => {
    const rendered = renderContactDeclinedEmail("nb-NO");
    expect(rendered.html).not.toContain("<a href=");
  });

  it("rendrer på engelsk når locale er en-GB", () => {
    const rendered = renderContactDeclinedEmail("en-GB");
    expect(rendered.subject).toBe("Contact declined");
  });
});
