import { describe, expect, it } from "vitest";
import { renderStaleRequestReminder30dEmail } from "./stale-request-reminder-30d";

describe("renderStaleRequestReminder30dEmail", () => {
  it("inneholder riktig emnefelt og tittelen i brødteksten", () => {
    const rendered = renderStaleRequestReminder30dEmail("nb-NO", "req-1", "Strømpriser i nord");
    expect(rendered.subject).toBe("Forespørselen din har vært åpen lenge");
    expect(rendered.html).toContain("Strømpriser i nord");
  });

  it("lenken peker på journalistens egen side, der lukkeknappen finnes", () => {
    const rendered = renderStaleRequestReminder30dEmail("nb-NO", "req-1", "Tittel");
    expect(rendered.html).toContain("/nb-NO/journalist/requests/req-1");
  });
});
