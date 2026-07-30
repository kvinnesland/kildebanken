import { describe, expect, it } from "vitest";
import { contrastRatio, oklchContrastRatio, oklchToSrgbHex, relativeLuminance } from "./oklch";

// Konverteringen er Björn Ottossons offentlig publiserte OKLab↔lineær
// sRGB-matriser (samme som CSS Color 4 og `culori`/`colorjs.io` bruker) —
// deterministisk matematikk, ikke skjønn. Testene under bruker AKROMATISKE
// referanseverdier (kroma = 0) fordi de kan etterregnes for hånd: enhver
// akromatisk OKLCH-verdi gir lineær R = G = B = L³ eksakt (radsummene i
// lineær-sRGB-matrisen er nøyaktig 1,0 for alle tre kanaler), noe som gjør
// det mulig å verifisere uten et eksternt fargeverktøy.

function hexToRgbBytes(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

describe("oklchToSrgbHex — akromatiske referanseverdier", () => {
  it("oklch(100% 0 0) er hvit", () => {
    expect(oklchToSrgbHex(1, 0, 0)).toBe("#ffffff");
  });

  it("oklch(0% 0 0) er svart", () => {
    expect(oklchToSrgbHex(0, 0, 0)).toBe("#000000");
  });

  it("oklch(50% 0 0) er IKKE rgb(128,128,128) — OKLabs lystetthet er perseptuell, ikke lineær sRGB-halvvei", () => {
    // Regnet for hånd: lineær R=G=B=0,5³=0,125; gamma-kodet ≈ 0,3886 ≈
    // byte 99 (0x63). Toleranse på ±2 for avrundingsforskjeller, ikke for å
    // skjule en reell feil.
    const [r, g, b] = hexToRgbBytes(oklchToSrgbHex(0.5, 0, 0));
    expect(r).toBe(g);
    expect(g).toBe(b);
    expect(r).toBeGreaterThanOrEqual(97);
    expect(r).toBeLessThanOrEqual(101);
  });

  it("hue-verdien påvirker IKKE en akromatisk farge (kroma = 0)", () => {
    expect(oklchToSrgbHex(0.5, 0, 0)).toBe(oklchToSrgbHex(0.5, 0, 230));
  });

  it("økende lystetthet gir en monotont lysere farge (langs akromatisk akse)", () => {
    const [darker] = hexToRgbBytes(oklchToSrgbHex(0.3, 0, 0));
    const [lighter] = hexToRgbBytes(oklchToSrgbHex(0.7, 0, 0));
    expect(lighter).toBeGreaterThan(darker);
  });
});

describe("relativeLuminance / contrastRatio (WCAG 2.x)", () => {
  it("hvit har relativ luminans 1, svart har 0", () => {
    expect(relativeLuminance(1, 1, 1)).toBeCloseTo(1, 5);
    expect(relativeLuminance(0, 0, 0)).toBeCloseTo(0, 5);
  });

  it("kontrastforholdet mellom rent hvitt og rent svart er nøyaktig 21:1 (lærebokverdien)", () => {
    const white = relativeLuminance(1, 1, 1);
    const black = relativeLuminance(0, 0, 0);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 1);
  });

  it("kontrastforholdet er symmetrisk uansett argumentrekkefølge", () => {
    const a = relativeLuminance(0.2, 0.2, 0.2);
    const b = relativeLuminance(0.8, 0.8, 0.8);
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });

  it("samme farge mot seg selv gir kontrastforhold 1:1", () => {
    const l = relativeLuminance(0.4, 0.4, 0.4);
    expect(contrastRatio(l, l)).toBeCloseTo(1, 10);
  });
});

describe("oklchContrastRatio — hele kjeden i ett steg", () => {
  it("gir samme svar som å regne luminans manuelt fra oklchToSrgbHex", () => {
    const combined = oklchContrastRatio({ l: 1, c: 0, h: 0 }, { l: 0, c: 0, h: 0 });
    expect(combined).toBeCloseTo(21, 1);
  });

  it("DESIGN.md 2.2: --color-text (gray-900) mot --color-bg (gray-50) i lyst tema når WCAG AA for normal tekst (4.5:1)", () => {
    // Verdiene er hentet direkte fra tokens/primitives.css.
    const textOnBg = oklchContrastRatio(
      { l: 0.21, c: 0.008, h: 250 }, // --gray-900
      { l: 0.985, c: 0.002, h: 250 } // --gray-50
    );
    expect(textOnBg).toBeGreaterThanOrEqual(4.5);
  });
});
