import { describe, expect, it } from "vitest";
import { isSafeRelativePath } from "./safe-redirect";

describe("isSafeRelativePath", () => {
  it("godtar en normal relativ sti", () => {
    expect(isSafeRelativePath("/nb-NO/foresporsler/123/en-sak")).toBe(true);
  });

  it("avviser null", () => {
    expect(isSafeRelativePath(null)).toBe(false);
  });

  it("avviser tom streng", () => {
    expect(isSafeRelativePath("")).toBe(false);
  });

  it("avviser protokoll-relative URL-er (//evil.com)", () => {
    expect(isSafeRelativePath("//evil.com")).toBe(false);
  });

  it("avviser absolutte eksterne URL-er", () => {
    expect(isSafeRelativePath("https://evil.com")).toBe(false);
    expect(isSafeRelativePath("http://evil.com/nb-NO")).toBe(false);
  });

  it("avviser stier som ikke starter med /", () => {
    expect(isSafeRelativePath("nb-NO/foresporsler")).toBe(false);
  });
});
