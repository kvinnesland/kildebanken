import { describe, expect, it } from "vitest";
import { renderChangesRequestedEmail } from "./changes-requested";

describe("renderChangesRequestedEmail", () => {
  it("inneholder riktig emnefelt og moderatorens kommentar", () => {
    const rendered = renderChangesRequestedEmail("nb-NO", "req-1", "Vær mer spesifikk om tidsrommet.");
    expect(rendered.subject).toBe("Endringer kreves for forespørselen din");
    expect(rendered.html).toContain("Vær mer spesifikk om tidsrommet.");
  });

  it("lenken peker på journalistens egen redigeringsside", () => {
    const rendered = renderChangesRequestedEmail("nb-NO", "req-1", "Kommentar");
    expect(rendered.html).toContain("/nb-NO/journalist/requests/req-1");
  });
});
