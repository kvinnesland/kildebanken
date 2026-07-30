import { describe, expect, it } from "vitest";
import { auditAllPairs, TOKEN_PAIRS } from "./contrast-pairs";

// DESIGN.md 2.4: "Testen kjører over den definerte listen av par i begge
// temaer og feiler CI ved avvik. Dette er den eneste måten et temabytte
// ikke stille kan bryte tilgjengelighetskravet i SPEC-V1.md 21.2."
describe("WCAG-kontrast for faktisk brukte tokenpar (DESIGN.md 2.4)", () => {
  for (const result of auditAllPairs()) {
    it(`${result.theme}: ${result.pair.name} (${result.pair.foreground} / ${result.pair.background}) ≥ ${result.required}:1`, () => {
      expect(result.ratio).toBeGreaterThanOrEqual(result.required);
    });
  }

  it("dekker minst ett par per kategori (tekst og grensesnittelement)", () => {
    const categories = new Set(TOKEN_PAIRS.map((p) => p.category));
    expect(categories).toEqual(new Set(["text", "ui-component"]));
  });
});
