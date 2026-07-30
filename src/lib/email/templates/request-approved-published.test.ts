import { describe, expect, it } from "vitest";
import { renderRequestApprovedPublishedEmail } from "./request-approved-published";

describe("renderRequestApprovedPublishedEmail", () => {
  it("inneholder riktig emnefelt og tittelen i brødteksten", () => {
    const rendered = renderRequestApprovedPublishedEmail(
      "nb-NO",
      "req-1",
      "Strømpriser i nord",
      "stromspriser-i-nord"
    );
    expect(rendered.subject).toBe("Forespørselen din er publisert");
    expect(rendered.html).toContain("Strømpriser i nord");
  });

  it("lenken peker på forespørselens offentlige side", () => {
    const rendered = renderRequestApprovedPublishedEmail("nb-NO", "req-1", "Tittel", "min-slug");
    expect(rendered.html).toContain("/nb-NO/foresporsler/req-1/min-slug");
  });

  it("SPEC-V1.md 3.7: bruker en-GB sitt eget, oversatte stinavn (requests), ikke nb-NO sitt", () => {
    const rendered = renderRequestApprovedPublishedEmail("en-GB", "req-1", "Title", "my-slug");
    expect(rendered.html).toContain("/en-GB/requests/req-1/my-slug");
  });
});
