// DESIGN.md 7: "E-postklienter støtter ikke CSS-variabler... Løsningen er
// ikke å ha to sannheter, men å eksportere tokenene ved bygg." Den fulle
// byggetids-pipelinen (tokens/primitives.css → tokens.json) er IKKE bygget
// ennå (samme, allerede noterte forenkling som `digest.ts` gjorde i en
// tidligere økt) — men i stedet for å la HVER e-postmal gjette sine egne
// literale fargeverdier (og drifte fra hverandre og fra de faktiske
// tokenene, se NATTLOGG.md økt 7: `digest.ts` sine opprinnelige verdier
// hadde faktisk driftet fra de ekte oklch-primitivene), er de samlet ETT
// sted her, beregnet med `oklchToSrgbHex()` — samme, verifiserte
// fargematematikk som WCAG-kontrasttesten (`contrast-pairs.ts`) bruker.
// `colors.test.ts` sjekker at disse konstantene fortsatt stemmer overens
// med de faktiske primitivene i `tokens/primitives.css` — det er den
// nærmeste tilnærmingen til "feiler CI ved avvik" uten hele
// eksport-pipelinen.
//
// Kun lyst tema — e-postmaler i dette prosjektet er ikke bygget for mørkt
// tema ennå (DESIGN.md 7 nevner `prefers-color-scheme`-støtte som et krav,
// notert som gjenstående i NATTLOGG.md sammen med selve eksport-pipelinen).

export const EMAIL_COLORS = {
  pageBackground: "#f9fafb", // --color-bg (--gray-50)
  surface: "#ffffff", // --color-surface (--gray-0)
  text: "#16191c", // --color-text (--gray-900)
  textMuted: "#595e64", // --color-text-muted (--gray-600)
  border: "#e3e7ea", // --color-border (--gray-200)
  accent: "#166f92", // --color-accent (--accent-600)
  accentText: "#ffffff", // --color-accent-text (--gray-0)
  link: "#0a5774", // --color-link (--accent-700)
} as const;
