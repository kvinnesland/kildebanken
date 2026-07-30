// Ren, avhengighetsfri OKLCH→sRGB-konvertering (DESIGN.md 2, "Definert i
// OKLCH"). Trengs to steder: (1) den automatiserte WCAG-kontrasttesten
// DESIGN.md 2.4 krever ("Testen kjører over den definerte listen av par i
// begge temaer og feiler CI ved avvik"), og (2) e-postmalenes token-eksport
// (DESIGN.md 7, "e-postklienter støtter ikke CSS-variabler... eksportere
// tokenene ved bygg"), siden ingen e-postklient (særlig Outlook) støtter
// `oklch()` som CSS-farge.
//
// Matrisene under er Björn Ottossons offentlig publiserte OKLab↔lineær
// sRGB-transformasjon (https://bottosson.github.io/posts/oklab/), samme
// matriser som CSS Color 4-spesifikasjonen og biblioteker som `culori`/
// `colorjs.io` bruker — IKKE noe skjønn eller en tilnærming, men den
// etablerte, deterministiske konverteringen. Verifisert i
// oklch.test.ts mot kjente akromatiske referanseverdier (hvit, svart,
// midtgrå) som kan etterregnes for hånd.

export interface LinearSrgb {
  r: number;
  g: number;
  b: number;
}

/** OKLCH → OKLab. `hueDegrees` i grader (som i CSS `oklch()`). */
function oklchToOklab(l: number, c: number, hueDegrees: number): { l: number; a: number; b: number } {
  const hueRadians = (hueDegrees * Math.PI) / 180;
  return {
    l,
    a: c * Math.cos(hueRadians),
    b: c * Math.sin(hueRadians),
  };
}

/**
 * OKLab → lineær sRGB (D65), UKLIPPET — verdier kan ligge utenfor [0, 1]
 * for farger utenfor sRGB-fargerommet. Kalleren klipper ved behov (se
 * `oklchToSrgbHex`).
 */
export function oklabToLinearSrgb(l: number, a: number, b: number): LinearSrgb {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

  const lCubed = l_ ** 3;
  const mCubed = m_ ** 3;
  const sCubed = s_ ** 3;

  return {
    r: 4.0767416621 * lCubed - 3.3077115913 * mCubed + 0.2309699292 * sCubed,
    g: -1.2684380046 * lCubed + 2.6097574011 * mCubed - 0.3413193965 * sCubed,
    b: -0.0041960863 * lCubed - 0.7034186147 * mCubed + 1.7076147010 * sCubed,
  };
}

/** OKLCH → lineær sRGB, uklippet. `l` er 0–1 (IKKE prosent), `h` i grader. */
export function oklchToLinearSrgb(l: number, c: number, h: number): LinearSrgb {
  const lab = oklchToOklab(l, c, h);
  return oklabToLinearSrgb(lab.l, lab.a, lab.b);
}

/** IEC 61966-2-1 gamma-koding, lineær → sRGB. Klipper til [0, 1] — farger
 * utenfor sRGB-fargerommet rendres til nærmeste representable verdi,
 * samme som en nettleser ville gjort. */
function linearChannelToSrgb(linear: number): number {
  const clampedLinear = Math.min(Math.max(linear, 0), 1);
  const encoded =
    clampedLinear <= 0.0031308
      ? 12.92 * clampedLinear
      : 1.055 * clampedLinear ** (1 / 2.4) - 0.055;
  return Math.min(Math.max(encoded, 0), 1);
}

function toHexByte(value0to1: number): string {
  const byte = Math.round(value0to1 * 255);
  return byte.toString(16).padStart(2, "0");
}

/** OKLCH → sRGB hex-streng (f.eks. "#1a2b3c"), for e-postmaler som ikke
 * støtter `oklch()`. `l` er 0–1 (IKKE prosent — gang med 0.01 selv om du
 * har en prosentverdi fra CSS-en, se DESIGN.md sine `oklch(58% 0.012 250)`-
 * skrivemåter). */
export function oklchToSrgbHex(l: number, c: number, h: number): string {
  const linear = oklchToLinearSrgb(l, c, h);
  const r = linearChannelToSrgb(linear.r);
  const g = linearChannelToSrgb(linear.g);
  const b = linearChannelToSrgb(linear.b);
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

/**
 * WCAG 2.x relativ luminans (brukt av kontrastformelen under). Tar
 * KLIPPEDE, gamma-KODEDE sRGB-kanaler (0–1) — IKKE de lineære verdiene fra
 * `oklchToLinearSrgb` direkte, siden WCAG sin formel selv definerer en egen
 * de-gamma-steg først (identisk med sRGB→lineær, men holdt atskilt her for
 * å følge WCAG-formelen ordrett i stedet for å anta den er identisk med
 * OKLab sin lineære mellomverdi).
 */
export function relativeLuminance(srgbR: number, srgbG: number, srgbB: number): number {
  const linearize = (channel: number) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

  const r = linearize(srgbR);
  const g = linearize(srgbG);
  const b = linearize(srgbB);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG-kontrastforhold mellom to relative luminanser (SPEC-V1.md 21.2,
 * DESIGN.md 2.4). Rekkefølgen på argumentene spiller ingen rolle. */
export function contrastRatio(luminanceA: number, luminanceB: number): number {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Slår sammen OKLCH → kontrastforhold i ett steg — for de faktiske
 * token-parene i `contrast-pairs.test.ts`. */
export function oklchContrastRatio(
  a: { l: number; c: number; h: number },
  b: { l: number; c: number; h: number }
): number {
  const linearA = oklchToLinearSrgb(a.l, a.c, a.h);
  const linearB = oklchToLinearSrgb(b.l, b.c, b.h);

  const srgbA = {
    r: linearChannelToSrgb(linearA.r),
    g: linearChannelToSrgb(linearA.g),
    b: linearChannelToSrgb(linearA.b),
  };
  const srgbB = {
    r: linearChannelToSrgb(linearB.r),
    g: linearChannelToSrgb(linearB.g),
    b: linearChannelToSrgb(linearB.b),
  };

  return contrastRatio(
    relativeLuminance(srgbA.r, srgbA.g, srgbA.b),
    relativeLuminance(srgbB.r, srgbB.g, srgbB.b)
  );
}
