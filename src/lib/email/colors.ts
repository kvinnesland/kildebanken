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

// DESIGN.md 7: "Mørkt tema via prefers-color-scheme der klienten støtter
// det." Samme prinsipp og samme verifiseringsmetode som EMAIL_COLORS over
// (`colors.test.ts` sjekker begge mot de faktiske oklch-primitivene) —
// verdiene her er hentet fra semantic.css sin egen
// `@media (prefers-color-scheme: dark)`-blokk, IKKE gjettet på nytt.
export const EMAIL_COLORS_DARK = {
  pageBackground: "#090b0e", // --color-bg mørkt (--gray-950)
  surface: "#16191c", // --color-surface mørkt (--gray-900)
  text: "#f1f4f6", // --color-text mørkt (--gray-100)
  textMuted: "#9da2a8", // --color-text-muted mørkt (--gray-400)
  border: "#25292e", // --color-border mørkt (--gray-800)
  accent: "#63a9c9", // --color-accent mørkt (--accent-400)
  accentText: "#090b0e", // --color-accent-text mørkt (--gray-950)
  link: "#93c6e0", // --color-link mørkt (--accent-300)
} as const;

// DESIGN.md 7: "Mørkt tema via prefers-color-scheme der klienten støtter
// det." E-postklienter støtter ikke CSS-variabler eller eksterne stilark,
// men de fleste som faktisk implementerer prefers-color-scheme (Apple Mail,
// nyere Gmail-apper) leser et innebygd <style>-element i <head> — derfor
// klassenavn (`eb-*`) i TILLEGG til de vanlige inline-stilene hver mal
// allerede setter (inline er selve det universelle fallback-laget for
// klienter uten <style>-støtte). `!important` er nødvendig her — uten det
// ville inline-stilen (høyere spesifisitet) alltid vunnet over klassen.
export function emailDarkModeStyleTag(): string {
  const d = EMAIL_COLORS_DARK;
  return `<style>@media (prefers-color-scheme: dark) {
  .eb-body { background-color: ${d.pageBackground} !important; }
  .eb-card { background-color: ${d.surface} !important; }
  .eb-text { color: ${d.text} !important; }
  .eb-muted { color: ${d.textMuted} !important; }
  .eb-link { color: ${d.link} !important; }
  .eb-button { background-color: ${d.accent} !important; color: ${d.accentText} !important; }
  .eb-border { border-color: ${d.border} !important; }
}</style>`;
}

// Signaliserer til klienter som FAKTISK håndterer dette selv at e-posten
// allerede støtter mørkt tema — hindrer at klienten i tillegg prøver å
// gjette seg til et mørkt tema med egen fargeinvertering (DESIGN.md 7:
// "farger som er lesbare også når klienten inverterer på egen hånd" —
// dette er den delen av kravet som faktisk FOREBYGGER at det skjer, i
// stedet for bare å tåle det).
export const EMAIL_COLOR_SCHEME_META =
  '<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">';
