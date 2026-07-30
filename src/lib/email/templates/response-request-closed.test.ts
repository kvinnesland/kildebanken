import { describe, expect, it } from "vitest";
import { renderResponseRequestClosedEmail } from "./response-request-closed";

describe("renderResponseRequestClosedEmail", () => {
  it("inneholder riktig emnefelt og tittelen i brødteksten", () => {
    const rendered = renderResponseRequestClosedEmail(
      "nb-NO",
      "req-1",
      "Strømpriser i nord",
      "stromspriser-i-nord"
    );
    expect(rendered.subject).toBe("Forespørselen du svarte på er lukket");
    expect(rendered.html).toContain("Strømpriser i nord");
  });

  it("lenken peker på forespørselens offentlige side", () => {
    const rendered = renderResponseRequestClosedEmail("nb-NO", "req-1", "Tittel", "min-slug");
    expect(rendered.html).toContain("/nb-NO/foresporsler/req-1/min-slug");
  });
});
