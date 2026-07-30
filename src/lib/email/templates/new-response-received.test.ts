import { describe, expect, it } from "vitest";
import { renderNewResponseReceivedEmail } from "./new-response-received";

describe("renderNewResponseReceivedEmail", () => {
  it("inneholder riktig emnefelt og forespørselens tittel", () => {
    const rendered = renderNewResponseReceivedEmail(
      "nb-NO",
      "req-1",
      "Søker personer som har byttet karriere"
    );
    expect(rendered.subject).toBe("Nytt svar mottatt");
    expect(rendered.html).toContain("Søker personer som har byttet karriere");
  });

  it("lenken peker på journalistens egen svarinnboks for forespørselen", () => {
    const rendered = renderNewResponseReceivedEmail("nb-NO", "req-1", "Tittel");
    expect(rendered.html).toContain("/nb-NO/journalist/requests/req-1/responses");
  });

  it("rendrer på engelsk når locale er en-GB", () => {
    const rendered = renderNewResponseReceivedEmail("en-GB", "req-1", "Title");
    expect(rendered.subject).toBe("New response received");
  });
});
