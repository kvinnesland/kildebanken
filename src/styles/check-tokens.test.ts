import { describe, expect, it } from "vitest";
import { findViolationsInCss } from "./check-tokens";

describe("findViolationsInCss (DESIGN.md 1)", () => {
  it("flagger en hex-farge", () => {
    const violations = findViolationsInCss("fixture.css", ".x { color: #ff0000; }");
    expect(violations.map((v) => v.rule)).toEqual(["hex-color"]);
  });

  it("flagger rgb()/rgba()", () => {
    const violations = findViolationsInCss("fixture.css", ".x { color: rgba(0, 0, 0, 0.5); }");
    expect(violations.map((v) => v.rule)).toEqual(["rgb-function"]);
  });

  it("flagger oklch() direkte i en komponentfil", () => {
    const violations = findViolationsInCss("fixture.css", ".x { color: oklch(50% 0.1 230); }");
    expect(violations.map((v) => v.rule)).toEqual(["oklch-function"]);
  });

  it("flagger en rå px-verdi som ikke er en hårfin kantlinje", () => {
    const violations = findViolationsInCss("fixture.css", ".x { padding: 16px; }");
    expect(violations.map((v) => v.rule)).toEqual(["raw-px"]);
  });

  it("tillater 1px og 2px (kantlinje/fokusring — universell konvensjon, ikke tokenisert)", () => {
    const violations = findViolationsInCss(
      "fixture.css",
      ".x { border: 1px solid var(--color-border); outline: 2px solid var(--color-focus-ring); }"
    );
    expect(violations).toEqual([]);
  });

  it("flagger direkte bruk av en lag 1-variabel i en komponentfil", () => {
    const violations = findViolationsInCss("fixture.css", ".x { color: var(--gray-500); }");
    expect(violations.map((v) => v.rule)).toEqual(["layer-1-variable"]);
  });

  it("godtar semantiske token-referanser uten å flagge noe", () => {
    const violations = findViolationsInCss(
      "fixture.css",
      ".x { color: var(--color-text); padding: var(--space-4); border-radius: var(--radius-md); }"
    );
    expect(violations).toEqual([]);
  });

  it("ignorerer verdier nevnt inne i en CSS-kommentar", () => {
    const violations = findViolationsInCss("fixture.css", "/* gammel farge var #ff0000, fjernet */\n.x { color: var(--color-text); }");
    expect(violations).toEqual([]);
  });
});
