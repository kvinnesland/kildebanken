import { describe, expect, it } from "vitest";
import { renderContactApprovedEmail } from "./contact-approved";

describe("renderContactApprovedEmail", () => {
  it("inneholder riktig emnefelt og overskrift", () => {
    const rendered = renderContactApprovedEmail("nb-NO", "cr-1");
    expect(rendered.subject).toBe("Kontakt godkjent");
    expect(rendered.html).toContain("Kontakt godkjent");
  });

  it("lenken peker på samme /[locale]/contact-requests/:id-side som contact_request_received brukte", () => {
    const rendered = renderContactApprovedEmail("nb-NO", "cr-1");
    expect(rendered.html).toContain("/nb-NO/contact-requests/cr-1");
  });
});
