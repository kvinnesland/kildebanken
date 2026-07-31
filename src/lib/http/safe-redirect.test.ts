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

  it("avviser baklengs skråstrek rett etter den innledende (/\\evil.com) — tolkes som // av URL-parseren", () => {
    // Bekreftet empirisk mot Node sin URL-parser (samme brukt i selve
    // redirect-kallet): new URL("/\\evil.com", origin) løser til
    // https://evil.com/, ikke origin sin egen host.
    expect(isSafeRelativePath("/\\evil.com")).toBe(false);
    expect(isSafeRelativePath("/\\evil.com/path")).toBe(false);
  });

  it("godtar en baklengs skråstrek SENERE i stien — bare et ordinært sti-skille", () => {
    expect(isSafeRelativePath("/nb-NO/foo\\bar")).toBe(true);
  });

  it("avviser en tab rett etter den innledende skråstreken (/\\t/evil.com) — WHATWG-parseren fjerner tab før parsing", () => {
    expect(isSafeRelativePath("/\t/evil.com")).toBe(false);
  });

  it("godtar en bar rot-sti (/)", () => {
    expect(isSafeRelativePath("/")).toBe(true);
  });
});
