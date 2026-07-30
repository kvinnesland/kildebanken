import { describe, expect, it } from "vitest";
import { renderConfirmAccountDeletionEmail } from "./confirm-account-deletion";

describe("renderConfirmAccountDeletionEmail", () => {
  it("inneholder riktig emnefelt og overskrift", () => {
    const rendered = renderConfirmAccountDeletionEmail("nb-NO", "abc123");
    expect(rendered.subject).toBe("Bekreft sletting av kontoen din");
    expect(rendered.html).toContain("Bekreft sletting av kontoen din");
  });

  it("lenken peker på /[locale]/me/slett-konto med tokenet, IKKE /api/auth/verify", () => {
    const rendered = renderConfirmAccountDeletionEmail("nb-NO", "abc123");
    expect(rendered.html).toContain("/nb-NO/me/slett-konto?token=abc123");
    expect(rendered.html).not.toContain("/api/auth/verify");
  });

  it("rendrer på engelsk når locale er en-GB", () => {
    const rendered = renderConfirmAccountDeletionEmail("en-GB", "abc123");
    expect(rendered.subject).toBe("Confirm deletion of your account");
    expect(rendered.html).toContain("/en-GB/me/slett-konto?token=abc123");
  });
});
