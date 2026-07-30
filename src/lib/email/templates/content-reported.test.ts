import { describe, expect, it } from "vitest";
import { renderContentReportedEmail } from "./content-reported";

describe("renderContentReportedEmail", () => {
  it("inneholder riktig emnefelt og begrunnelsen", () => {
    const rendered = renderContentReportedEmail("nb-NO", "request", "Upassende innhold", "");
    expect(rendered.subject).toBe("Innhold rapportert");
    expect(rendered.html).toContain("Upassende innhold");
  });

  it("inkluderer kommentaren når den finnes", () => {
    const rendered = renderContentReportedEmail("nb-NO", "response", "Upassende innhold", "En kommentar til.");
    expect(rendered.html).toContain("En kommentar til.");
  });

  it("lenken peker på modereringskøen", () => {
    const rendered = renderContentReportedEmail("nb-NO", "request", "reason", "");
    expect(rendered.html).toContain("/nb-NO/admin/requests");
  });
});
