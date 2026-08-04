import { describe, expect, it } from "vitest";
import { sanitizeErrorMessage } from "./error-sanitize";

// INFRASTRUCTURE.md 10: "Personopplysninger logges ikke: ingen
// e-postadresser, ingen svartekst." Enhver feil fanget i tick.ts/
// retention.ts sine jobbløkker havner til slutt i et JSON.stringify'et,
// logget resultat (netlify/functions/tick.ts) — reelt hull frem til nå
// (se NATTLOGG.md, økt 94): en rå leverandør-/databasefeilmelding kunne i
// prinsippet inneholde en ekte e-postadresse.
describe("sanitizeErrorMessage (INFRASTRUCTURE.md 10)", () => {
  it("fjerner en e-postadresse fra en Brevo-lignende feilmelding", () => {
    const err = new Error("Brevo-sending feilet (400): invalid recipient mottaker@example.com");
    expect(sanitizeErrorMessage(err)).toBe(
      "Brevo-sending feilet (400): invalid recipient [e-post fjernet]"
    );
  });

  it("fjerner en e-postadresse fra en Postgres-lignende unikhetsbrudd-melding", () => {
    const err = new Error(
      'duplicate key value violates unique constraint "users_email_key" DETAIL: Key (email)=(bruker@eksempel.no) already exists.'
    );
    expect(sanitizeErrorMessage(err)).toContain("[e-post fjernet]");
    expect(sanitizeErrorMessage(err)).not.toContain("bruker@eksempel.no");
  });

  it("fjerner FLERE e-postadresser i samme melding", () => {
    const err = new Error("a@example.com kolliderte med b@example.com");
    const result = sanitizeErrorMessage(err);
    expect(result).toBe("[e-post fjernet] kolliderte med [e-post fjernet]");
  });

  it("lar en feilmelding uten noen e-postadresse stå uendret", () => {
    const err = new Error("nettverksfeil: timeout etter 5000ms");
    expect(sanitizeErrorMessage(err)).toBe("nettverksfeil: timeout etter 5000ms");
  });

  it("håndterer et kastet objekt som ikke er en ekte Error-instans", () => {
    expect(sanitizeErrorMessage("streng med adresse@eksempel.no")).toBe(
      "streng med [e-post fjernet]"
    );
    expect(sanitizeErrorMessage(42)).toBe("42");
  });
});
