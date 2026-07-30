// DESIGN.md 2.4: "Alle kombinasjoner som faktisk brukes, skal testes
// automatisk mot WCAG 2.2 AA... Testen kjører over den definerte listen av
// par i begge temaer og feiler CI ved avvik." Dette er den listen, pluss
// maskineriet som løser et semantisk tokennavn til en faktisk OKLCH-verdi i
// et gitt tema.
//
// Leser `tokens/primitives.css` og `tokens/semantic.css` direkte (samme
// regex-baserte mønster som `src/i18n/check-keys.ts` og
// `src/styles/check-tokens.ts` allerede bruker) i stedet for å duplisere
// tallene en fjerde gang — risikoen for at testen stille slutter å teste de
// EKTE verdiene (fordi noen glemte å oppdatere ett av flere separate steder)
// er verre enn kompleksiteten ved å parse CSS-en direkte.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { oklchContrastRatio, type Oklch } from "./oklch";

const TOKENS_DIR = join(import.meta.dirname, "..", "tokens");

const OKLCH_VAR_PATTERN = /--([a-z]+-\d+):\s*oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)/g;
const VAR_MAPPING_PATTERN = /--(color-[a-z0-9-]+):\s*var\(\s*--([a-z]+-\d+)\s*\)/g;

export type Theme = "light" | "dark";

/** Alle primitiver (lag 1) definert i `tokens/primitives.css`, som rå OKLCH. */
export function parsePrimitives(): Record<string, Oklch> {
  const content = readFileSync(join(TOKENS_DIR, "primitives.css"), "utf-8");
  const primitives: Record<string, Oklch> = {};
  for (const match of content.matchAll(OKLCH_VAR_PATTERN)) {
    const [, name, l, c, h] = match;
    if (!name || l === undefined || c === undefined || h === undefined) continue;
    primitives[name] = { l: Number(l) / 100, c: Number(c), h: Number(h) };
  }
  return primitives;
}

/**
 * Semantiske tokens (lag 2) → hvilken primitiv de peker på, for ett gitt
 * tema. `tokens/semantic.css` har tre `:root`-blokker i kildeteksten (lyst
 * standardvalg øverst, `prefers-color-scheme: dark`-blokken, og den
 * eksplisitte `[data-theme="dark"]`-blokken) — de to siste er alltid
 * identiske i praksis (samme verdier, to forskjellige triggere for å velge
 * mørkt tema), så vi trenger bare skille "øverste blokk" fra "resten".
 *
 * Mørkt tema overstyrer BARE et delmengde av rollene (bg/surface/border/
 * tekst/aksent/fokusring) — status-rollene (`--color-danger` m.fl.) er
 * bevisst uendret på tvers av tema (se semantic.css), akkurat som ekte CSS
 * custom properties arver fra `:root` når en mer spesifikk selector ikke
 * definerer dem selv. Derfor slås lyst tema inn som grunnlag FØRST, så
 * overstyrer mørkt tema det som faktisk er annerledes — akkurat som
 * nettleseren selv ville gjort det ved kaskadering.
 */
export function parseSemanticMapping(theme: Theme): Record<string, string> {
  const content = readFileSync(join(TOKENS_DIR, "semantic.css"), "utf-8");
  const firstDarkBlockStart = content.indexOf('@media (prefers-color-scheme: dark)');
  const lightBlock = content.slice(0, firstDarkBlockStart);
  const darkBlock = content.slice(firstDarkBlockStart);

  function extract(text: string): Record<string, string> {
    const mapping: Record<string, string> = {};
    for (const match of text.matchAll(VAR_MAPPING_PATTERN)) {
      const [, semanticName, primitiveName] = match;
      if (!semanticName || !primitiveName) continue;
      mapping[semanticName] = primitiveName;
    }
    return mapping;
  }

  const lightMapping = extract(lightBlock);
  if (theme === "light") return lightMapping;
  return { ...lightMapping, ...extract(darkBlock) };
}

export function resolveToken(theme: Theme, semanticName: string): Oklch {
  const primitives = parsePrimitives();
  const mapping = parseSemanticMapping(theme);
  const primitiveName = mapping[semanticName];
  if (!primitiveName) {
    throw new Error(`Ukjent semantisk token "${semanticName}" i ${theme}-temaet`);
  }
  const oklch = primitives[primitiveName];
  if (!oklch) {
    throw new Error(`"${semanticName}" peker på ukjent primitiv "--${primitiveName}"`);
  }
  return oklch;
}

export type ContrastCategory = "text" | "ui-component";

/** WCAG 2.2 AA-terskler, DESIGN.md 2.4: 4.5:1 for vanlig tekst, 3:1 for
 * store overskrifter og grensesnittelementer/fokusmarkering. */
export const MIN_RATIO: Record<ContrastCategory, number> = {
  text: 4.5,
  "ui-component": 3,
};

export interface TokenPair {
  name: string;
  foreground: string;
  background: string;
  category: ContrastCategory;
}

/**
 * Faktisk brukte (forgrunn, bakgrunn)-par, hentet ved å lese gjennom
 * `color`/`background`-egenskapene i komponent- og side-CSS-filene
 * (`src/components/*.module.css`, registrerings-/journalist-skjemaene,
 * den offentlige vilkårssiden). Manuelt kuratert, ikke automatisk
 * ekstrahert fra CSS-en — samme avveining som `check-tokens.ts` sin
 * kommentarstripping: presis nok til formålet, uten å bygge en ekte
 * CSS-AST-parser for én lint-sjekk. Oppdater denne listen når et nytt
 * fargepar tas i bruk et sted i grensesnittet.
 */
export const TOKEN_PAIRS: readonly TokenPair[] = [
  // Brødtekst/etiketter mot de to bakgrunnene innhold faktisk vises på.
  { name: "brødtekst på sidebakgrunn", foreground: "color-text", background: "color-bg", category: "text" },
  { name: "brødtekst på flate (skjemafelt, kort)", foreground: "color-text", background: "color-surface", category: "text" },
  { name: "dempet tekst på flate (beskrivelse, TextField)", foreground: "color-text-muted", background: "color-surface", category: "text" },
  { name: "lenketekst på sidebakgrunn", foreground: "color-link", background: "color-bg", category: "text" },
  { name: "lenketekst på flate", foreground: "color-link", background: "color-surface", category: "text" },

  // Knapper (Button.module.css).
  { name: "primærknapp-tekst på aksentbakgrunn", foreground: "color-accent-text", background: "color-accent", category: "text" },
  { name: "primærknapp-tekst, hover", foreground: "color-accent-text", background: "color-accent-hover", category: "text" },
  { name: "sekundærknapp-tekst på flate", foreground: "color-text", background: "color-surface", category: "text" },
  { name: "faretruende-knapp-tekst på fare-bakgrunn", foreground: "color-on-danger", background: "color-danger", category: "text" },

  // Skjemafelt (TextField/Select/Checkbox).
  { name: "feiltekst på flate", foreground: "color-danger-text", background: "color-surface", category: "text" },
  { name: "valgt alternativ i nedtrekksliste", foreground: "color-accent", background: "color-accent-subtle", category: "text" },

  // Bannere (SubscribeForm/JournalistApplyForm sine suksess-/feilmeldinger).
  { name: "feilbanner-tekst", foreground: "color-danger", background: "color-danger-subtle", category: "text" },
  { name: "suksessbanner-tekst", foreground: "color-success", background: "color-success-subtle", category: "text" },

  // Ikke-tekst grensesnittelementer (WCAG 1.4.11 via DESIGN.md 2.4 sin
  // "3:1 ... for grensesnittelementer og fokusmarkering").
  { name: "feltkant (TextField/Select/Checkbox) mot flate", foreground: "color-border-strong", background: "color-surface", category: "ui-component" },
  { name: "fokusring mot flate", foreground: "color-focus-ring", background: "color-surface", category: "ui-component" },
  { name: "fokusring mot sidebakgrunn", foreground: "color-focus-ring", background: "color-bg", category: "ui-component" },
];

export interface ContrastResult {
  theme: Theme;
  pair: TokenPair;
  ratio: number;
  required: number;
  passes: boolean;
}

export function auditPair(theme: Theme, pair: TokenPair): ContrastResult {
  const fg = resolveToken(theme, pair.foreground);
  const bg = resolveToken(theme, pair.background);
  const ratio = oklchContrastRatio(fg, bg);
  const required = MIN_RATIO[pair.category];
  return { theme, pair, ratio, required, passes: ratio >= required };
}

export function auditAllPairs(): ContrastResult[] {
  const themes: Theme[] = ["light", "dark"];
  return themes.flatMap((theme) => TOKEN_PAIRS.map((pair) => auditPair(theme, pair)));
}
