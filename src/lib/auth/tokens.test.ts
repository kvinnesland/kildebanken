import { describe, expect, it } from "vitest";
import { generateToken, hashToken, tokensMatch } from "./tokens";

describe("tokens", () => {
  it("genererer forskjellige tokens hver gang", () => {
    expect(generateToken()).not.toBe(generateToken());
  });

  it("hasher deterministisk — samme rå token gir samme hash", () => {
    const raw = generateToken();
    expect(hashToken(raw)).toBe(hashToken(raw));
  });

  it("ulike rå tokens gir ulik hash", () => {
    expect(hashToken(generateToken())).not.toBe(hashToken(generateToken()));
  });

  it("tokensMatch er sann for identiske strenger", () => {
    const raw = generateToken();
    expect(tokensMatch(raw, raw)).toBe(true);
  });

  it("tokensMatch er usann for ulike strenger, selv med samme lengde", () => {
    const a = "a".repeat(32);
    const b = "b".repeat(32);
    expect(tokensMatch(a, b)).toBe(false);
  });
});
