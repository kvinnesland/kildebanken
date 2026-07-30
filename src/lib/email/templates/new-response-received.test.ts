import { describe, expect, it } from "vitest";
import { renderNewResponseReceivedEmail } from "./new-response-received";

describe("renderNewResponseReceivedEmail", () => {
  it("inneholder riktig emnefelt og forespørselens tittel", () => {
    const rendered = renderNewResponseReceivedEmail(
      "nb-NO",
      "req-1",
      "Søker personer som har byttet karriere",
      "soker-personer"
    );
    expect(rendered.subject).toBe("Nytt svar mottatt");
    expect(rendered.html).toContain("Søker personer som har byttet karriere");
  });

  it("lenken peker på forespørselens offentlige side (midlertidig, se NATTLOGG.md om svarinnboksen)", () => {
    const rendered = renderNewResponseReceivedEmail("nb-NO", "req-1", "Tittel", "min-slug");
    expect(rendered.html).toContain("/nb-NO/foresporsler/req-1/min-slug");
  });

  it("rendrer på engelsk når locale er en-GB", () => {
    const rendered = renderNewResponseReceivedEmail("en-GB", "req-1", "Title", "slug");
    expect(rendered.subject).toBe("New response received");
  });
});
