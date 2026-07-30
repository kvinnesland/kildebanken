import { describe, expect, it } from "vitest";
import { renderResponseSubmittedReceiptEmail } from "./response-submitted-receipt";

describe("renderResponseSubmittedReceiptEmail", () => {
  it("inneholder riktig emnefelt og forespørselens tittel", () => {
    const rendered = renderResponseSubmittedReceiptEmail(
      "nb-NO",
      "req-1",
      "Søker personer som har byttet karriere",
      "soker-personer"
    );
    expect(rendered.subject).toBe("Kvittering: Svaret ditt er sendt");
    expect(rendered.html).toContain("Søker personer som har byttet karriere");
  });

  it("lenken peker på forespørselens offentlige side", () => {
    const rendered = renderResponseSubmittedReceiptEmail("nb-NO", "req-1", "Tittel", "min-slug");
    expect(rendered.html).toContain("/nb-NO/foresporsler/req-1/min-slug");
  });

  it("har ingen 'ba du ikke om dette'-linje (det er en ekte kvittering, ikke en selvbetjent handling)", () => {
    const rendered = renderResponseSubmittedReceiptEmail("nb-NO", "req-1", "Tittel", "slug");
    expect(rendered.text).not.toContain("Ba du ikke om");
  });

  it("rendrer på engelsk når locale er en-GB", () => {
    const rendered = renderResponseSubmittedReceiptEmail("en-GB", "req-1", "Title", "slug");
    expect(rendered.subject).toBe("Receipt: Your response has been sent");
  });
});
