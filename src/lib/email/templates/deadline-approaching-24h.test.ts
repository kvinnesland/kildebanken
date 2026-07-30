import { describe, expect, it } from "vitest";
import { renderDeadlineApproaching24hEmail } from "./deadline-approaching-24h";

describe("renderDeadlineApproaching24hEmail", () => {
  it("inneholder riktig emnefelt og tittelen i brødteksten", () => {
    const rendered = renderDeadlineApproaching24hEmail("nb-NO", "req-1", "Strømpriser i nord");
    expect(rendered.subject).toBe("Forespørselen din utløper om 24 timer");
    expect(rendered.html).toContain("Strømpriser i nord");
  });

  it("lenken peker på journalistens egen side for forespørselen", () => {
    const rendered = renderDeadlineApproaching24hEmail("nb-NO", "req-1", "Tittel");
    expect(rendered.html).toContain("/nb-NO/journalist/requests/req-1");
  });
});
