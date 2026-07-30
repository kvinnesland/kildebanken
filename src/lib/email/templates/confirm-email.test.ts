import { describe, expect, it } from "vitest";
import { renderConfirmEmailEmail } from "./confirm-email";

describe("renderConfirmEmailEmail", () => {
  it("inneholder riktig emnefelt og overskrift", () => {
    const rendered = renderConfirmEmailEmail("nb-NO", "abc123");
    expect(rendered.subject).toBe("Bekreft e-postadressen din");
    expect(rendered.html).toContain("Bekreft e-postadressen din");
  });

  it("lenken peker på GET /api/auth/verify med token og locale", () => {
    const rendered = renderConfirmEmailEmail("nb-NO", "abc123");
    expect(rendered.html).toContain("/api/auth/verify?token=abc123&locale=nb-NO");
  });

  it("rendrer på engelsk når locale er en-GB", () => {
    const rendered = renderConfirmEmailEmail("en-GB", "abc123");
    expect(rendered.subject).toBe("Confirm your email address");
  });
});
