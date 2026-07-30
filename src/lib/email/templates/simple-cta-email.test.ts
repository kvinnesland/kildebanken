import { describe, expect, it } from "vitest";
import { renderSimpleCtaEmail } from "./simple-cta-email";

describe("renderSimpleCtaEmail", () => {
  it("escaper HTML i innholdet (forsvarlig selv om i18n-tekst i dag er statisk)", () => {
    const rendered = renderSimpleCtaEmail({
      locale: "nb-NO",
      subject: "Test",
      heading: '<script>alert("x")</script>',
      body: "body",
      ctaLabel: "cta",
      ctaUrl: "https://example.invalid/verify?token=abc",
      ignoreNote: "note",
    });
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
  });

  it("DESIGN.md 7: tabellbasert, én kolonne, maks 600px, ingen EKSTERN stilark", () => {
    const rendered = renderSimpleCtaEmail({
      locale: "nb-NO",
      subject: "Test",
      heading: "heading",
      body: "body",
      ctaLabel: "cta",
      ctaUrl: "https://example.invalid",
      ignoreNote: "note",
    });
    expect(rendered.html).toContain("max-width:600px");
    expect(rendered.html).toContain("<table");
    // "All CSS inlines" (7) betyr ingen EKSTERNT stilark — et innebygd
    // <style>-element for prefers-color-scheme-støtte er selve KRAVET i
    // samme seksjon ("Mørkt tema via prefers-color-scheme"), ikke et brudd
    // på det. Se emailDarkModeStyleTag()/testen under.
    expect(rendered.html).not.toContain('rel="stylesheet"');
  });

  it("DESIGN.md 7: mørkt tema via prefers-color-scheme, med color-scheme-metatagger som forhindrer klientens egen auto-invertering", () => {
    const rendered = renderSimpleCtaEmail({
      locale: "nb-NO",
      subject: "Test",
      heading: "heading",
      body: "body",
      ctaLabel: "cta",
      ctaUrl: "https://example.invalid",
    });
    expect(rendered.html).toContain("@media (prefers-color-scheme: dark)");
    expect(rendered.html).toContain('<meta name="color-scheme" content="light dark">');
    expect(rendered.html).toContain('<meta name="supported-color-schemes" content="light dark">');
    expect(rendered.html).toContain('class="eb-body"');
    expect(rendered.html).toContain('class="eb-card"');
    expect(rendered.html).toContain('class="eb-button"');
  });

  it("setter lang-attributtet til riktig locale", () => {
    const rendered = renderSimpleCtaEmail({
      locale: "en-GB",
      subject: "Test",
      heading: "heading",
      body: "body",
      ctaLabel: "cta",
      ctaUrl: "https://example.invalid",
      ignoreNote: "note",
    });
    expect(rendered.html).toContain('lang="en-GB"');
  });

  it("ignoreNote er valgfri — utelates helt fra HTML og tekst når den ikke er satt (rene varsler har ingen 'ba du ikke om dette'-vinkel)", () => {
    const rendered = renderSimpleCtaEmail({
      locale: "nb-NO",
      subject: "Test",
      heading: "heading",
      body: "body",
      ctaLabel: "cta",
      ctaUrl: "https://example.invalid",
    });
    expect(rendered.text).toBe("heading\n\nbody\n\nhttps://example.invalid");
  });

  it("ctaLabel/ctaUrl er valgfrie — utelates helt fra HTML og tekst når malen ikke har noen oppfølgingshandling (f.eks. et avslag)", () => {
    const rendered = renderSimpleCtaEmail({
      locale: "nb-NO",
      subject: "Test",
      heading: "heading",
      body: "body",
    });
    expect(rendered.text).toBe("heading\n\nbody");
    expect(rendered.html).not.toContain("<a href=");
  });
});
