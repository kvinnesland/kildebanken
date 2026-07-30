// DESIGN.md 1: "En komponent skal aldri referere til lag 1, og aldri
// inneholde en farge-, avstands- eller radiusverdi direkte. Brytes den, er
// temaet ikke lenger byttbart... Håndheves med lint-regel som feiler CI på
// hex-verdier, rgb(), oklch(), px-verdier utenfor tokenfilene, og på bruk av
// lag 1-variabler i komponentfiler."
//
// Kjøres som `npm run design:check-tokens`. Samme mønster som
// src/i18n/check-keys.ts (rene, testbare funksjoner + en main() som kjører
// bare når scriptet startes direkte).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC_DIR = join(import.meta.dirname, "..");
const TOKENS_DIR_SEGMENT = `${join("styles", "tokens")}${sep}`;
const GLOBALS_CSS_SUFFIX = join("styles", "globals.css");

const HEX_COLOR_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_FUNCTION_PATTERN = /\brgba?\(/g;
const OKLCH_FUNCTION_PATTERN = /\boklch\(/g;
const RAW_PX_PATTERN = /\b\d+(?:\.\d+)?px\b/g;
const LAYER_1_VARIABLE_PATTERN = /var\(\s*--(gray|accent|success|warning|danger)-\d/g;

// 1px/2px er hårfine kantlinje-/fokusring-bredder (DESIGN.md 4: "Standardvalget
// er kantlinje... skygge brukes bare på flater som faktisk ligger over andre";
// 6.1: "2 px ring"). Det er en universell UI-konvensjon, ikke en
// avstands-/radiusverdi DESIGN.md ber om å tokenisere — verken
// tokens/primitives.css eller semantic.css definerer noen egen
// border-width-skala. Alt annet (padding, min-height, gap, radius) SKAL bruke
// --space-*/--radius-*.
const ALLOWED_RAW_PX_VALUES = new Set(["1px", "2px"]);

export interface TokenViolation {
  file: string;
  line: number;
  rule: "hex-color" | "rgb-function" | "oklch-function" | "raw-px" | "layer-1-variable";
  snippet: string;
}

/** Fjerner CSS-kommentarer FØR mønstersøk — en kommentar som NEVNER en
 * farge er ikke en farge i selve stilarket. */
function stripCssComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, "");
}

function findRawPxMatches(lineText: string): string[] {
  return [...lineText.matchAll(RAW_PX_PATTERN)]
    .map((m) => m[0])
    .filter((value) => !ALLOWED_RAW_PX_VALUES.has(value));
}

export function findViolationsInCss(file: string, rawContent: string): TokenViolation[] {
  const content = stripCssComments(rawContent);
  const violations: TokenViolation[] = [];
  const lines = content.split("\n");

  const simpleChecks: Array<[TokenViolation["rule"], RegExp]> = [
    ["hex-color", HEX_COLOR_PATTERN],
    ["rgb-function", RGB_FUNCTION_PATTERN],
    ["oklch-function", OKLCH_FUNCTION_PATTERN],
    ["layer-1-variable", LAYER_1_VARIABLE_PATTERN],
  ];

  lines.forEach((lineText, index) => {
    for (const [rule, pattern] of simpleChecks) {
      pattern.lastIndex = 0;
      if (pattern.test(lineText)) {
        violations.push({ file, line: index + 1, rule, snippet: lineText.trim() });
      }
    }

    if (findRawPxMatches(lineText).length > 0) {
      violations.push({ file, line: index + 1, rule: "raw-px", snippet: lineText.trim() });
    }
  });

  return violations;
}

function collectCssFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectCssFiles(full, files);
    } else if (/\.css$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function isTokenOrGlobalFile(file: string): boolean {
  const rel = relative(SRC_DIR, file);
  return rel.includes(TOKENS_DIR_SEGMENT) || rel === GLOBALS_CSS_SUFFIX;
}

function main() {
  const allCssFiles = collectCssFiles(SRC_DIR);
  const componentCssFiles = allCssFiles.filter((f) => !isTokenOrGlobalFile(f));

  const violations = componentCssFiles.flatMap((file) =>
    findViolationsInCss(relative(SRC_DIR, file), readFileSync(file, "utf-8"))
  );

  if (violations.length > 0) {
    console.error(
      `[design:check-tokens] ${violations.length} brudd på DESIGN.md 1 funnet i komponentfiler ` +
        `(kun tokens/*.css og globals.css får inneholde rå verdier):\n` +
        violations.map((v) => `  - ${v.file}:${v.line} [${v.rule}] ${v.snippet}`).join("\n")
    );
    process.exit(1);
  }

  console.log(
    `[design:check-tokens] OK — ${componentCssFiles.length} komponent-CSS-fil(er) sjekket, ingen rå verdier funnet.`
  );
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
