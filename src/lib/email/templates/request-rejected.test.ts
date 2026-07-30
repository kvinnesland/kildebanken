import { describe, expect, it } from "vitest";
import { renderRequestRejectedEmail } from "./request-rejected";

describe("renderRequestRejectedEmail", () => {
  it("inneholder riktig emnefelt og begrunnelsen", () => {
    const rendered = renderRequestRejectedEmail("nb-NO", "Manglet et legitimt journalistisk formål.");
    expect(rendered.subject).toBe("Forespørselen din er avvist");
    expect(rendered.html).toContain("Manglet et legitimt journalistisk formål.");
  });

  it("har ingen CTA-knapp — avvisning er endelig, ingen oppfølgingshandling", () => {
    const rendered = renderRequestRejectedEmail("nb-NO", "Begrunnelse");
    expect(rendered.html).not.toContain("<a href=");
  });
});
