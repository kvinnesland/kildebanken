import { describe, expect, it } from "vitest";
import { renderNewRequestForModerationEmail } from "./new-request-for-moderation";

describe("renderNewRequestForModerationEmail", () => {
  it("inneholder riktig emnefelt og tittelen i brødteksten", () => {
    const rendered = renderNewRequestForModerationEmail("nb-NO", "Strømpriser i nord");
    expect(rendered.subject).toBe("Ny forespørsel til moderering");
    expect(rendered.html).toContain("Strømpriser i nord");
  });

  it("lenken peker på modereringskøen", () => {
    const rendered = renderNewRequestForModerationEmail("nb-NO", "Tittel");
    expect(rendered.html).toContain("/nb-NO/admin/requests");
  });
});
