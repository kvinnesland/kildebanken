import { describe, expect, it } from "vitest";
import { renderJournalistApplicationReceivedEmail } from "./journalist-application-received";

describe("renderJournalistApplicationReceivedEmail", () => {
  it("inneholder riktig emnefelt og overskrift", () => {
    const rendered = renderJournalistApplicationReceivedEmail("nb-NO", "abc123");
    expect(rendered.subject).toBe("Søknaden din er mottatt");
    expect(rendered.html).toContain("Søknaden din er mottatt");
  });

  it("lenken peker på GET /api/auth/verify med token og locale — samme mekanisme som magic_link/confirm_email", () => {
    const rendered = renderJournalistApplicationReceivedEmail("nb-NO", "abc123");
    expect(rendered.html).toContain("/api/auth/verify?token=abc123&locale=nb-NO");
  });

  it("rendrer på engelsk når locale er en-GB", () => {
    const rendered = renderJournalistApplicationReceivedEmail("en-GB", "abc123");
    expect(rendered.subject).toBe("Your application has been received");
  });
});
