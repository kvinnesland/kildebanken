import { describe, expect, it } from "vitest";
import { renderContactRequestReceivedEmail } from "./contact-request-received";

describe("renderContactRequestReceivedEmail", () => {
  it("inneholder riktig emnefelt og overskrift", () => {
    const rendered = renderContactRequestReceivedEmail(
      "nb-NO",
      "cr-1",
      "Søker kilder til sak om strømpriser",
      "Kari Journalist",
      "Testavisen"
    );
    expect(rendered.subject).toBe("Forespørsel om videre kontakt");
    expect(rendered.html).toContain("Forespørsel om videre kontakt");
  });

  it("setter journalistnavn, redaksjon og forespørselstittel inn i teksten", () => {
    const rendered = renderContactRequestReceivedEmail(
      "nb-NO",
      "cr-1",
      "Søker kilder til sak om strømpriser",
      "Kari Journalist",
      "Testavisen"
    );
    expect(rendered.html).toContain("Kari Journalist");
    expect(rendered.html).toContain("Testavisen");
    expect(rendered.html).toContain("Søker kilder til sak om strømpriser");
  });

  it("lenken peker på /[locale]/contact-requests/:id", () => {
    const rendered = renderContactRequestReceivedEmail("nb-NO", "cr-1", "tittel", "navn", "org");
    expect(rendered.html).toContain("/nb-NO/contact-requests/cr-1");
  });
});
