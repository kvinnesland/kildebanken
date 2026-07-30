import { describe, expect, it } from "vitest";
import { shouldEscalateToHardBounce } from "./bounce-policy";

describe("shouldEscalateToHardBounce", () => {
  it("eskalerer IKKE ved første og andre myke bounce", () => {
    expect(shouldEscalateToHardBounce(0)).toBe(false); // dette blir den 1.
    expect(shouldEscalateToHardBounce(1)).toBe(false); // dette blir den 2.
  });

  it("eskalerer ved den TREDJE sammenhengende myke bounce-en", () => {
    expect(shouldEscalateToHardBounce(2)).toBe(true); // dette blir den 3.
  });

  it("eskalerer fortsatt ved flere enn tre (skal ikke kreve eksakt telling)", () => {
    expect(shouldEscalateToHardBounce(5)).toBe(true);
  });
});
