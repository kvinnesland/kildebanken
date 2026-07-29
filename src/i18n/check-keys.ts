// FR-012: "Byggesteget skal feile dersom en oversettelsesnøkkel brukt i
// koden mangler i plattformens standardspråk." Kjøres som `npm run
// i18n:check`, som skal være del av CI før `next build`.
//
// Sjekker bare mot plattformens standardspråk (nb-NO) — andre locales skal
// gi advarsel, ikke feile bygget (SPEC-V1.md 21.3: "manglende oversettelse i
// andre språk gir advarsel og fallback").

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import nbNO from "./messages/nb-NO.json";

const KEY_PATTERN = /\bt\(\s*["'`]([a-zA-Z0-9_.]+)["'`]/g;
const SRC_DIR = join(import.meta.dirname, "..");

export function findMissingKeys(
  usedKeys: readonly string[],
  available: Record<string, string>
): string[] {
  const availableKeys = new Set(Object.keys(available));
  return [...new Set(usedKeys)].filter((k) => !availableKeys.has(k));
}

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectSourceFiles(full, files);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.ts$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function extractUsedKeys(files: string[]): string[] {
  const keys: string[] = [];
  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    for (const match of content.matchAll(KEY_PATTERN)) {
      const key = match[1];
      if (key) keys.push(key);
    }
  }
  return keys;
}

function main() {
  const files = collectSourceFiles(SRC_DIR);
  const usedKeys = extractUsedKeys(files);
  const missing = findMissingKeys(usedKeys, nbNO);

  if (missing.length > 0) {
    console.error(
      `[i18n:check] ${missing.length} nøkkel(er) brukt i koden mangler i plattformens ` +
        `standardspråk (nb-NO):\n` +
        missing.map((k) => `  - ${k}`).join("\n")
    );
    process.exit(1);
  }

  console.log(`[i18n:check] OK — ${usedKeys.length} nøkler funnet, alle finnes i nb-NO.`);
}

// Kjør bare når scriptet startes direkte (ikke når det importeres av testen).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
