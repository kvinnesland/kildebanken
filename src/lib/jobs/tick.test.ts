import { describe, expect, it } from "vitest";
import { localTimeForTimezone } from "./tick";

// Verifiserer bare formatet — selve klokkeslettet avhenger av når testen
// kjøres. Den reelle sommertid-sensitiviteten (INFRASTRUCTURE.md 5.2) testes
// best med en fikstur-dato senere; se NATTLOGG.md.
describe("localTimeForTimezone", () => {
  it("returnerer dato i YYYY-MM-DD-format", () => {
    const { localDate } = localTimeForTimezone("Europe/Oslo");
    expect(localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returnerer klokkeslett i HH:MM-format", () => {
    const { localTimeHHMM } = localTimeForTimezone("Europe/Oslo");
    expect(localTimeHHMM).toMatch(/^\d{2}:\d{2}$/);
  });

  it("gir samme øyeblikk ulikt klokkeslett i to tidssoner (normalt)", () => {
    const oslo = localTimeForTimezone("Europe/Oslo");
    const utc = localTimeForTimezone("UTC");
    // Oslo er UTC+1 eller UTC+2 avhengig av sommertid — aldri UTC+0.
    expect(oslo.localTimeHHMM).not.toBe(utc.localTimeHHMM);
  });
});
