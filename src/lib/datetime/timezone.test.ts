import { describe, expect, it } from "vitest";
import { utcToZonedWallTime, zonedWallTimeToUtc } from "./timezone";

describe("zonedWallTimeToUtc", () => {
  it("UTC er identitet", () => {
    expect(zonedWallTimeToUtc("2026-01-15T12:00", "UTC").toISOString()).toBe("2026-01-15T12:00:00.000Z");
  });

  it("Europe/Oslo om vinteren (CET, UTC+1)", () => {
    expect(zonedWallTimeToUtc("2026-01-15T12:00", "Europe/Oslo").toISOString()).toBe(
      "2026-01-15T11:00:00.000Z"
    );
  });

  it("Europe/Oslo om sommeren (CEST, UTC+2 — krysser sommertidsovergangen korrekt)", () => {
    expect(zonedWallTimeToUtc("2026-07-15T12:00", "Europe/Oslo").toISOString()).toBe(
      "2026-07-15T10:00:00.000Z"
    );
  });

  it("America/Los_Angeles om vinteren (PST, UTC-8)", () => {
    expect(zonedWallTimeToUtc("2026-01-15T12:00", "America/Los_Angeles").toISOString()).toBe(
      "2026-01-15T20:00:00.000Z"
    );
  });

  it("America/Los_Angeles om sommeren (PDT, UTC-7)", () => {
    expect(zonedWallTimeToUtc("2026-07-15T12:00", "America/Los_Angeles").toISOString()).toBe(
      "2026-07-15T19:00:00.000Z"
    );
  });

  it("Asia/Kathmandu (fast UTC+5:45, ingen sommertid — dekker ikke-hele-timer-forskyvninger)", () => {
    expect(zonedWallTimeToUtc("2026-01-15T12:00", "Asia/Kathmandu").toISOString()).toBe(
      "2026-01-15T06:15:00.000Z"
    );
  });

  it("kaster ved ugyldig format", () => {
    expect(() => zonedWallTimeToUtc("15/01/2026 12:00", "UTC")).toThrow();
  });
});

describe("utcToZonedWallTime", () => {
  it("er den nøyaktige inversen av zonedWallTimeToUtc for en vintersone (Europe/Oslo, CET)", () => {
    const utc = zonedWallTimeToUtc("2026-01-15T12:00", "Europe/Oslo");
    expect(utcToZonedWallTime(utc, "Europe/Oslo")).toBe("2026-01-15T12:00");
  });

  it("er den nøyaktige inversen for en sommersone (Europe/Oslo, CEST)", () => {
    const utc = zonedWallTimeToUtc("2026-07-15T12:00", "Europe/Oslo");
    expect(utcToZonedWallTime(utc, "Europe/Oslo")).toBe("2026-07-15T12:00");
  });

  it("er inversen for en ikke-hel-time-forskyvning (Asia/Kathmandu)", () => {
    const utc = zonedWallTimeToUtc("2026-01-15T12:00", "Asia/Kathmandu");
    expect(utcToZonedWallTime(utc, "Asia/Kathmandu")).toBe("2026-01-15T12:00");
  });
});
