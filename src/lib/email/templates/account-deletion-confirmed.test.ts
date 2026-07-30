import { describe, expect, it } from "vitest";
import { renderAccountDeletionConfirmedEmail } from "./account-deletion-confirmed";

describe("renderAccountDeletionConfirmedEmail", () => {
  it("inneholder riktig emnefelt og overskrift", () => {
    const rendered = renderAccountDeletionConfirmedEmail("nb-NO");
    expect(rendered.subject).toBe("Kontoen din er slettet");
    expect(rendered.html).toContain("Kontoen din er slettet");
  });

  it("har ingen CTA-knapp — ingenting igjen å gjøre noe med", () => {
    const rendered = renderAccountDeletionConfirmedEmail("nb-NO");
    expect(rendered.html).not.toContain("<a href=");
  });

  it("rendrer på engelsk når locale er en-GB", () => {
    const rendered = renderAccountDeletionConfirmedEmail("en-GB");
    expect(rendered.subject).toBe("Your account has been deleted");
  });
});
