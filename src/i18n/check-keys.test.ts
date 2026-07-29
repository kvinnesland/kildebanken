import { describe, expect, it } from "vitest";
import { findMissingKeys } from "./check-keys";

// Verifiserer selve FR-012-akseptansekriteriet med en fikstur, slik
// SPEC-V1.md 22 sier: "CI-kjøring mot en fikstur med manglende nøkkel."
describe("findMissingKeys (FR-012)", () => {
  it("flagger en nøkkel brukt i koden som ikke finnes i standardspråket", () => {
    const available = { "common.footer.contact": "Kontakt oss" };
    const used = ["common.footer.contact", "some.key.that.does.not.exist"];

    expect(findMissingKeys(used, available)).toEqual([
      "some.key.that.does.not.exist",
    ]);
  });

  it("gir tom liste når alle brukte nøkler finnes", () => {
    const available = { "a.b": "x", "c.d": "y" };
    expect(findMissingKeys(["a.b", "c.d"], available)).toEqual([]);
  });
});
