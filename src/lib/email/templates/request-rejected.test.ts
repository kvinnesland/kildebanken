import { describe, expect, it } from "vitest";
import { renderRequestRejectedEmail } from "./request-rejected";

describe("renderRequestRejectedEmail", () => {
  it("inneholder riktig emnefelt og begrunnelsen", () => {
    const rendered = renderRequestRejectedEmail(
      "nb-NO",
      "Journalisters spørsmål til kommunen",
      "Manglet et legitimt journalistisk formål."
    );
    expect(rendered.subject).toBe("Forespørselen din er avvist");
    expect(rendered.html).toContain("Manglet et legitimt journalistisk formål.");
  });

  it("inneholder forespørselens tittel — uten CTA-lenke er dette den ENESTE måten å se hvilken forespørsel som ble avvist, gitt en journalist kan ha flere samtidig innsendte", () => {
    const rendered = renderRequestRejectedEmail("nb-NO", "Journalisters spørsmål til kommunen", "Begrunnelse");
    expect(rendered.html).toContain("Journalisters spørsmål til kommunen");
  });

  it("har ingen CTA-knapp — avvisning er endelig, ingen oppfølgingshandling", () => {
    const rendered = renderRequestRejectedEmail("nb-NO", "Tittel", "Begrunnelse");
    expect(rendered.html).not.toContain("<a href=");
  });
});
