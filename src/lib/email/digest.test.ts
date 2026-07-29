import { describe, expect, it } from "vitest";
import { insertPerRecipientTokens, renderDigestContent, type DigestRequestItem } from "./digest";

const sampleRequest: DigestRequestItem = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "soker-personer-som-har-byttet-karriere",
  title: "Søker personer som har byttet karriere",
  summary: "Har du gått fra fast jobb til selvstendig næringsdrivende?",
  organizationName: "Eksempelavisen",
  responseDeadline: new Date("2026-08-15T12:00:00Z"),
  geographicNote: "Oslo",
  contentLanguage: "nb-NO",
};

describe("renderDigestContent", () => {
  it("rendrer riktig antall i emnefeltet (ICU-flertall)", () => {
    const one = renderDigestContent("nb-NO", [sampleRequest]);
    expect(one.subject).toContain("1 ny forespørsel i dag");

    const many = renderDigestContent("nb-NO", [sampleRequest, sampleRequest]);
    expect(many.subject).toContain("2 nye forespørsler i dag");
  });

  it("inneholder plassholdere, ikke faktiske tokens, før innsetting", () => {
    const rendered = renderDigestContent("nb-NO", [sampleRequest]);
    expect(rendered.html).toContain("__ACCESS_TOKEN__");
    expect(rendered.html).toContain("__UNSUBSCRIBE_TOKEN__");
  });

  it("escaper HTML i brukergenerert innhold (tittel/oppsummering)", () => {
    const malicious: DigestRequestItem = {
      ...sampleRequest,
      title: '<script>alert("x")</script>',
    };
    const rendered = renderDigestContent("nb-NO", [malicious]);
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
  });

  it("viser fremmedspråk-varsel når innholdsspråk avviker fra locale", () => {
    const foreign: DigestRequestItem = { ...sampleRequest, contentLanguage: "en-GB" };
    const rendered = renderDigestContent("nb-NO", [foreign]);
    expect(rendered.html).toContain("et annet språk enn ditt");
  });

  it("viser IKKE fremmedspråk-varsel når språkene stemmer overens", () => {
    const rendered = renderDigestContent("nb-NO", [sampleRequest]);
    expect(rendered.html).not.toContain("et annet språk enn ditt");
  });
});

describe("insertPerRecipientTokens", () => {
  it("bytter ut begge plassholderne med de faktiske tokenene", () => {
    const rendered = renderDigestContent("nb-NO", [sampleRequest]);
    const personalized = insertPerRecipientTokens(rendered, "access-abc", "unsub-xyz");

    expect(personalized.html).not.toContain("__ACCESS_TOKEN__");
    expect(personalized.html).not.toContain("__UNSUBSCRIBE_TOKEN__");
    expect(personalized.html).toContain("da=access-abc");
    expect(personalized.html).toContain("/unsubscribe/unsub-xyz");
    expect(personalized.text).toContain("access-abc");
    expect(personalized.text).toContain("unsub-xyz");
  });

  it("endrer ikke emnefeltet", () => {
    const rendered = renderDigestContent("nb-NO", [sampleRequest]);
    const personalized = insertPerRecipientTokens(rendered, "a", "b");
    expect(personalized.subject).toBe(rendered.subject);
  });
});
