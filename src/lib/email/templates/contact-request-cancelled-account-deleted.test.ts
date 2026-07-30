import { describe, expect, it } from "vitest";
import { renderContactRequestCancelledAccountDeletedEmail } from "./contact-request-cancelled-account-deleted";

describe("renderContactRequestCancelledAccountDeletedEmail", () => {
  it("inneholder riktig emnefelt og overskrift", () => {
    const rendered = renderContactRequestCancelledAccountDeletedEmail("nb-NO");
    expect(rendered.subject).toBe("Kontaktforespørselen din er kansellert");
    expect(rendered.html).toContain("Kontaktforespørselen din er kansellert");
  });

  it("har ingen CTA-knapp — respondentens konto er slettet, ingenting igjen å handle på", () => {
    const rendered = renderContactRequestCancelledAccountDeletedEmail("nb-NO");
    expect(rendered.html).not.toContain("<a href=");
  });

  it("rendrer på engelsk når locale er en-GB", () => {
    const rendered = renderContactRequestCancelledAccountDeletedEmail("en-GB");
    expect(rendered.subject).toBe("Your contact request has been cancelled");
  });
});
