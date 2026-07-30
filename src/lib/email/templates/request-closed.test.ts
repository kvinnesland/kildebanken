import { describe, expect, it } from "vitest";
import { renderRequestClosedEmail } from "./request-closed";

describe("renderRequestClosedEmail", () => {
  it("inneholder riktig emnefelt og tittelen i brødteksten", () => {
    const rendered = renderRequestClosedEmail("nb-NO", "req-1", "Strømpriser i nord");
    expect(rendered.subject).toBe("Forespørselen din er lukket");
    expect(rendered.html).toContain("Strømpriser i nord");
  });

  it("lenken peker på journalistens egen redigeringsside for forespørselen", () => {
    const rendered = renderRequestClosedEmail("nb-NO", "req-1", "Strømpriser i nord");
    expect(rendered.html).toContain("/nb-NO/journalist/requests/req-1");
  });
});
