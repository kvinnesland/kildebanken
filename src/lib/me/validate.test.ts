import { describe, expect, it } from "vitest";
import { isValidTimezone } from "./validate";

describe("isValidTimezone", () => {
  it("godtar en gyldig IANA-tidssone", () => {
    expect(isValidTimezone("Europe/Oslo")).toBe(true);
    expect(isValidTimezone("America/New_York")).toBe(true);
  });

  it("avviser tomstreng og oppdiktede navn", () => {
    expect(isValidTimezone("")).toBe(false);
    expect(isValidTimezone("Not/A_Timezone")).toBe(false);
  });
});
