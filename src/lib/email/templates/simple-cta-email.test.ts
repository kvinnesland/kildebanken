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

  it("DESIGN.md 7: tabellbasert, én kolonne, maks 600px, all CSS inlinet", () => {
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
    expect(rendered.html).not.toContain("<style");
    expect(rendered.html).not.toContain('rel="stylesheet"');
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
