import { describe, expect, it } from "vitest";
import { oklchToSrgbHex } from "@/styles/color/oklch";
import { parsePrimitives } from "@/styles/color/contrast-pairs";
import { EMAIL_COLORS } from "./colors";

// Bekrefter at EMAIL_COLORS faktisk stemmer overens med de EKTE
// oklch-primitivene i tokens/primitives.css — den nærmeste tilnærmingen til
// DESIGN.md 7 sitt "feiler CI ved avvik" uten hele byggetids-eksport-
// pipelinen. Endres en primitiv uten å oppdatere EMAIL_COLORS, feiler denne.
describe("EMAIL_COLORS stemmer med de faktiske designtokenene", () => {
  const primitives = parsePrimitives();

  function hexFor(primitiveName: string): string {
    const oklch = primitives[primitiveName];
    if (!oklch) throw new Error(`Ukjent primitiv "--${primitiveName}" i tokens/primitives.css`);
    return oklchToSrgbHex(oklch.l, oklch.c, oklch.h);
  }

  it.each([
    ["pageBackground", "gray-50"],
    ["surface", "gray-0"],
    ["text", "gray-900"],
    ["textMuted", "gray-600"],
    ["border", "gray-200"],
    ["accent", "accent-600"],
    ["accentText", "gray-0"],
    ["link", "accent-700"],
  ] as const)("%s matcher --%s", (colorKey, primitiveName) => {
    expect(EMAIL_COLORS[colorKey]).toBe(hexFor(primitiveName));
  });
});
