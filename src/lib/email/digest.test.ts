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

  it("SPEC-V1.md 21.2: setter lang-attributt på tittel/oppsummering/stedsnotat til forespørselens EGET innholdsspråk, ikke digestens locale", () => {
    const foreign: DigestRequestItem = { ...sampleRequest, contentLanguage: "en-GB" };
    const rendered = renderDigestContent("nb-NO", [foreign]);

    expect(rendered.html).toContain('<h2 lang="en-GB"');
    expect(rendered.html).toContain('<p class="eb-text" lang="en-GB"');
    expect(rendered.html).toContain('<p class="eb-muted" lang="en-GB"');
  });

  it("SPEC-V1.md 3.7: bruker locale-ens EGET, oversatte stinavn i lenken, ikke alltid nb-NO sitt", () => {
    const nbRendered = renderDigestContent("nb-NO", [sampleRequest]);
    expect(nbRendered.html).toContain(encodeURIComponent(`/nb-NO/foresporsler/${sampleRequest.id}/${sampleRequest.slug}`));

    const enRendered = renderDigestContent("en-GB", [sampleRequest]);
    expect(enRendered.html).toContain(encodeURIComponent(`/en-GB/requests/${sampleRequest.id}/${sampleRequest.slug}`));
    expect(enRendered.html).not.toContain(encodeURIComponent("/en-GB/foresporsler/"));
  });

  it("DESIGN.md 7: mørkt tema via prefers-color-scheme, med color-scheme-metatagger", () => {
    const rendered = renderDigestContent("nb-NO", [sampleRequest]);
    expect(rendered.html).toContain("@media (prefers-color-scheme: dark)");
    expect(rendered.html).toContain('<meta name="color-scheme" content="light dark">');
    expect(rendered.html).toContain('class="eb-body"');
    expect(rendered.html).toContain('class="eb-card"');
    expect(rendered.html).toContain('class="eb-button"');
    expect(rendered.html).toContain('class="eb-link"');
  });
});

describe("insertPerRecipientTokens", () => {
  it("bytter ut begge plassholderne med de faktiske tokenene", () => {
    const rendered = renderDigestContent("nb-NO", [sampleRequest]);
    const personalized = insertPerRecipientTokens(rendered, "access-abc", "unsub-xyz");

    expect(personalized.html).not.toContain("__ACCESS_TOKEN__");
    expect(personalized.html).not.toContain("__UNSUBSCRIBE_TOKEN__");
    expect(personalized.html).toContain("/api/digest-access/access-abc?to=");
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
