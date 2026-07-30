import { afterEach, describe, expect, it, vi } from "vitest";
import { isRetentionDryRun, monthsAgo, yearsAgo } from "./retention";

describe("monthsAgo", () => {
  it("trekker fra riktig antall måneder", () => {
    const from = new Date("2026-07-30T12:00:00Z");
    expect(monthsAgo(12, from).toISOString()).toBe("2025-07-30T12:00:00.000Z");
  });

  it("håndterer årsskifte", () => {
    const from = new Date("2026-01-15T00:00:00Z");
    expect(monthsAgo(2, from).toISOString()).toBe("2025-11-15T00:00:00.000Z");
  });
});

describe("yearsAgo", () => {
  it("trekker fra riktig antall år", () => {
    const from = new Date("2026-07-30T12:00:00Z");
    expect(yearsAgo(3, from).toISOString()).toBe("2023-07-30T12:00:00.000Z");
  });
});

describe("isRetentionDryRun", () => {
  const ORIGINAL = process.env.RETENTION_DRY_RUN;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.RETENTION_DRY_RUN;
    else process.env.RETENTION_DRY_RUN = ORIGINAL;
    vi.unstubAllEnvs();
  });

  it("er sann (trygg standard) når variabelen ikke er satt", () => {
    delete process.env.RETENTION_DRY_RUN;
    expect(isRetentionDryRun()).toBe(true);
  });

  it("er sann for enhver verdi som ikke er nøyaktig 'false'", () => {
    process.env.RETENTION_DRY_RUN = "true";
    expect(isRetentionDryRun()).toBe(true);
    process.env.RETENTION_DRY_RUN = "nei takk";
    expect(isRetentionDryRun()).toBe(true);
  });

  it("er usann BARE når eksplisitt satt til 'false'", () => {
    process.env.RETENTION_DRY_RUN = "false";
    expect(isRetentionDryRun()).toBe(false);
  });
});
