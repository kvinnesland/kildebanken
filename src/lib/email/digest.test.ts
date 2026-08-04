import { afterEach, describe, expect, it, vi } from "vitest";
import {
  insertPerRecipientTokens,
  renderDigestContent,
  resolveSiteOrigin,
  type DigestRequestItem,
} from "./digest";

// INFRASTRUCTURE.md 9 / NATTLOGG.md: et glemt NEXT_PUBLIC_SITE_ORIGIN i
// produksjon skal ALDRI stille falle tilbake til plassholderdomenet — se
// samme sperre og begrunnelse som BREVO_API_KEY-sperren i send.test.ts.
describe("resolveSiteOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("bruker plassholderdomenet i ikke-produksjon når miljøvariabelen mangler", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_ORIGIN", "");
    vi.stubEnv("NODE_ENV", "test");

    expect(resolveSiteOrigin()).toBe("https://kildebanken.example");
  });

  it("bruker den konfigurerte verdien når den er satt, uansett miljø", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_ORIGIN", "https://kildebanken.no");
    vi.stubEnv("NODE_ENV", "production");

    expect(resolveSiteOrigin()).toBe("https://kildebanken.no");
  });

  it("kaster i produksjon i stedet for å falle tilbake til plassholderdomenet", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_ORIGIN", "");
    vi.stubEnv("NODE_ENV", "production");

    expect(() => resolveSiteOrigin()).toThrow(/NEXT_PUBLIC_SITE_ORIGIN/);
  });
});

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
    const one = renderDigestContent("nb-NO", [sampleRequest], "Europe/Oslo", "2026-08-15");
    expect(one.subject).toContain("1 ny forespørsel i dag");

    const many = renderDigestContent("nb-NO", [sampleRequest, sampleRequest], "Europe/Oslo", "2026-08-15");
    expect(many.subject).toContain("2 nye forespørsler i dag");
  });

  it("inneholder plassholdere, ikke faktiske tokens, før innsetting", () => {
    const rendered = renderDigestContent("nb-NO", [sampleRequest], "Europe/Oslo", "2026-08-15");
    expect(rendered.html).toContain("__ACCESS_TOKEN__");
    expect(rendered.html).toContain("__UNSUBSCRIBE_TOKEN__");
  });

  // SPEC-V1.md 3.4 sitt mellomledd (landets default_locale), nå koblet inn
  // gjennom createTranslator() (se NATTLOGG.md, økt 85/86) — bakover-
  // kompatibilitet: samme resultat med og uten det femte, valgfrie
  // argumentet, siden nb-NO faktisk har hver eneste nøkkel som brukes her.
  it("gir identisk resultat med og uten countryDefaultLocale når forespurt locale allerede har nøkkelen", () => {
    const withoutArg = renderDigestContent("nb-NO", [sampleRequest], "Europe/Oslo", "2026-08-15");
    const withArg = renderDigestContent(
      "nb-NO",
      [sampleRequest],
      "Europe/Oslo",
      "2026-08-15",
      "en-GB"
    );
    expect(withArg).toEqual(withoutArg);
  });

  it("escaper HTML i brukergenerert innhold (tittel/oppsummering)", () => {
    const malicious: DigestRequestItem = {
      ...sampleRequest,
      title: '<script>alert("x")</script>',
    };
    const rendered = renderDigestContent("nb-NO", [malicious], "Europe/Oslo", "2026-08-15");
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
  });

  it("viser fremmedspråk-varsel når innholdsspråk avviker fra locale", () => {
    const foreign: DigestRequestItem = { ...sampleRequest, contentLanguage: "en-GB" };
    const rendered = renderDigestContent("nb-NO", [foreign], "Europe/Oslo", "2026-08-15");
    expect(rendered.html).toContain("et annet språk enn ditt");
  });

  it("viser IKKE fremmedspråk-varsel når språkene stemmer overens", () => {
    const rendered = renderDigestContent("nb-NO", [sampleRequest], "Europe/Oslo", "2026-08-15");
    expect(rendered.html).not.toContain("et annet språk enn ditt");
  });

  it("SPEC-V1.md 21.2: setter lang-attributt på tittel/oppsummering/stedsnotat til forespørselens EGET innholdsspråk, ikke digestens locale", () => {
    const foreign: DigestRequestItem = { ...sampleRequest, contentLanguage: "en-GB" };
    const rendered = renderDigestContent("nb-NO", [foreign], "Europe/Oslo", "2026-08-15");

    expect(rendered.html).toContain('<h2 lang="en-GB"');
    expect(rendered.html).toContain('<p class="eb-text" lang="en-GB"');
    expect(rendered.html).toContain('<p class="eb-muted" lang="en-GB"');
  });

  it("SPEC-V1.md 3.7: bruker locale-ens EGET, oversatte stinavn i lenken, ikke alltid nb-NO sitt", () => {
    const nbRendered = renderDigestContent("nb-NO", [sampleRequest], "Europe/Oslo", "2026-08-15");
    expect(nbRendered.html).toContain(encodeURIComponent(`/nb-NO/foresporsler/${sampleRequest.id}/${sampleRequest.slug}`));

    const enRendered = renderDigestContent("en-GB", [sampleRequest], "Europe/Oslo", "2026-08-15");
    expect(enRendered.html).toContain(encodeURIComponent(`/en-GB/requests/${sampleRequest.id}/${sampleRequest.slug}`));
    expect(enRendered.html).not.toContain(encodeURIComponent("/en-GB/foresporsler/"));
  });

  it("SPEC-V1.md 3.6/10.2: svarfristen vises i LANDETS tidssone, med tidssonen angitt — ikke serverens egen", () => {
    const oslo = renderDigestContent("nb-NO", [sampleRequest], "Europe/Oslo", "2026-08-15");
    const tokyo = renderDigestContent("nb-NO", [sampleRequest], "Asia/Tokyo", "2026-08-15");

    // Samme UTC-tidspunkt, ULIKE tidssoner — den formaterte klokkeslettet skal
    // derfor faktisk avvike (ikke begge falle tilbake til samme, ambigue
    // serverlokale tidssone).
    expect(oslo.html).not.toBe(tokyo.html);
    expect(oslo.html).toContain("(Europe/Oslo)");
    expect(oslo.text).toContain("(Europe/Oslo)");
    expect(tokyo.html).toContain("(Asia/Tokyo)");
  });

  it("SPEC-V1.md 10.2: viser en faktisk dato, formatert for mottakerens locale — ikke bare 'i dag'", () => {
    const nbRendered = renderDigestContent("nb-NO", [sampleRequest], "Europe/Oslo", "2026-08-15");
    expect(nbRendered.html).toContain("lørdag 15. august 2026");
    expect(nbRendered.text).toContain("lørdag 15. august 2026");

    const enRendered = renderDigestContent("en-GB", [sampleRequest], "Europe/Oslo", "2026-08-15");
    expect(enRendered.html).toContain("Saturday, 15 August 2026");
  });

  it("DESIGN.md 7: mørkt tema via prefers-color-scheme, med color-scheme-metatagger", () => {
    const rendered = renderDigestContent("nb-NO", [sampleRequest], "Europe/Oslo", "2026-08-15");
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
    const rendered = renderDigestContent("nb-NO", [sampleRequest], "Europe/Oslo", "2026-08-15");
    const personalized = insertPerRecipientTokens(rendered, "access-abc", "unsub-xyz");

    expect(personalized.html).not.toContain("__ACCESS_TOKEN__");
    expect(personalized.html).not.toContain("__UNSUBSCRIBE_TOKEN__");
    expect(personalized.html).toContain("/api/digest-access/access-abc?to=");
    expect(personalized.html).toContain("/unsubscribe/unsub-xyz");
    expect(personalized.text).toContain("access-abc");
    expect(personalized.text).toContain("unsub-xyz");
  });

  it("endrer ikke emnefeltet", () => {
    const rendered = renderDigestContent("nb-NO", [sampleRequest], "Europe/Oslo", "2026-08-15");
    const personalized = insertPerRecipientTokens(rendered, "a", "b");
    expect(personalized.subject).toBe(rendered.subject);
  });
});
