import { describe, expect, it } from "vitest";
import { renderContentReportedEmail } from "./content-reported";

describe("renderContentReportedEmail", () => {
  it("inneholder riktig emnefelt og begrunnelsen", () => {
    const rendered = renderContentReportedEmail("nb-NO", "request", "request-1", "Upassende innhold", "");
    expect(rendered.subject).toBe("Innhold rapportert");
    expect(rendered.html).toContain("Upassende innhold");
  });

  it("inkluderer kommentaren når den finnes", () => {
    const rendered = renderContentReportedEmail(
      "nb-NO",
      "response",
      "response-1",
      "Upassende innhold",
      "En kommentar til."
    );
    expect(rendered.html).toContain("En kommentar til.");
  });

  it("en rapportert forespørsel lenker til modereringskøen", () => {
    const rendered = renderContentReportedEmail("nb-NO", "request", "request-1", "reason", "");
    expect(rendered.html).toContain("/nb-NO/admin/requests");
  });

  it("et rapportert svar lenker til DET SPESIFIKKE svaret, ikke modereringskøen (16.2: 'ingen visning som lister svar på tvers av forespørsler')", () => {
    const rendered = renderContentReportedEmail("nb-NO", "response", "response-42", "reason", "");
    expect(rendered.html).toContain("/nb-NO/admin/responses/response-42");
    expect(rendered.html).not.toContain("/nb-NO/admin/requests");
  });
});
