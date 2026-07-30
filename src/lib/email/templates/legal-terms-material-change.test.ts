import { describe, expect, it } from "vitest";
import { renderLegalTermsMaterialChangeEmail } from "./legal-terms-material-change";

describe("renderLegalTermsMaterialChangeEmail", () => {
  it("inneholder riktig emnefelt for vilkår", () => {
    const rendered = renderLegalTermsMaterialChangeEmail("nb-NO", "terms", "NO");
    expect(rendered.subject).toBe("Vi har oppdatert vilkårene");
    expect(rendered.html).toContain("vilkårene");
  });

  it("inneholder riktig emnefelt og tekst for personvernerklæring", () => {
    const rendered = renderLegalTermsMaterialChangeEmail("nb-NO", "privacy", "NO");
    expect(rendered.subject).toBe("Vi har oppdatert personvernerklæringen");
    expect(rendered.html).toContain("personvernerklæringen");
  });

  it("lenken peker på dokumentets offentlige side med små bokstaver i landkoden", () => {
    const rendered = renderLegalTermsMaterialChangeEmail("nb-NO", "terms", "NO");
    expect(rendered.html).toContain("/nb-NO/legal/no/nb-NO/terms");
  });
});
