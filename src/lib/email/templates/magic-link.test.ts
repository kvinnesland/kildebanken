import { describe, expect, it } from "vitest";
import { renderMagicLinkEmail } from "./magic-link";

describe("renderMagicLinkEmail", () => {
  it("inneholder riktig emnefelt og overskrift på riktig locale", () => {
    const rendered = renderMagicLinkEmail("nb-NO", "abc123");
    expect(rendered.subject).toBe("Din innloggingslenke");
    expect(rendered.html).toContain("Logg inn");
    expect(rendered.html).toContain('lang="nb-NO"');
  });

  it("lenken peker på GET /api/auth/verify med token og locale, url-kodet", () => {
    const rendered = renderMagicLinkEmail("nb-NO", "token med spesialtegn+/=");
    const expectedToken = encodeURIComponent("token med spesialtegn+/=");
    expect(rendered.html).toContain(`/api/auth/verify?token=${expectedToken}&locale=nb-NO`);
    expect(rendered.text).toContain(`/api/auth/verify?token=${expectedToken}&locale=nb-NO`);
  });

  it("rendrer på engelsk når locale er en-GB", () => {
    const rendered = renderMagicLinkEmail("en-GB", "abc123");
    expect(rendered.subject).toBe("Your login link");
    expect(rendered.html).toContain("Log in");
  });

  it("ren tekst-varianten er en reell variant, ikke maskinstrippet HTML (DESIGN.md 7)", () => {
    const rendered = renderMagicLinkEmail("nb-NO", "abc123");
    expect(rendered.text).not.toContain("<");
    expect(rendered.text).toContain("Logg inn");
  });
});
