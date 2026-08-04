import { describe, expect, it } from "vitest";
import { findLegallyReviewedGaps, findLocaleGaps, findMissingKeys } from "./check-keys";

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

// SPEC-V1.md 21.3: "manglende oversettelse i andre språk gir advarsel og
// fallback" — et EGET tilfelle fra FR-012 over (som gjelder nøkler brukt i
// koden mot standardspråket, og feiler bygget). Denne oppdaget en reell,
// ekte lekkasje denne økten: to nøkler fantes i nb-NO men manglet i en-GB
// helt uten at noe varslet om det (se NATTLOGG.md).
describe("findLocaleGaps (SPEC-V1.md 21.3)", () => {
  it("flagger en nøkkel som finnes i standardspråket men mangler i et annet språk", () => {
    const nb = { "a.b": "x", "c.d": "y" };
    const en = { "a.b": "x" };

    expect(findLocaleGaps(nb, en)).toEqual(["c.d"]);
  });

  it("gir tom liste når det andre språket har alle standardspråkets nøkler", () => {
    const nb = { "a.b": "x", "c.d": "y" };
    const en = { "a.b": "x", "c.d": "y", "e.f": "z" };

    expect(findLocaleGaps(nb, en)).toEqual([]);
  });
});

// SPEC-V1.md 12.3: bekreftelsesskjermen før innsending av svar er "juridisk
// relevant og skal gjennomgås av jurist i hvert språk den tilbys på. Den
// faller ikke tilbake til et annet språk" — et EKSPLISITT unntak fra 21.3s
// ellers gjeldende advarsel+reservevei-regel, se
// LEGALLY_REVIEWED_TRANSLATION_KEYS (config.ts) for den fulle listen.
describe("findLegallyReviewedGaps (SPEC-V1.md 12.3)", () => {
  it("skiller ut de av 21.3s hull som gjelder juridisk gjennomgått tekst", () => {
    const gaps = ["response.confirm.may_be_quoted", "some.ordinary.key"];
    const legallyReviewedKeys = ["response.confirm.may_be_quoted", "response.confirm.title"];

    expect(findLegallyReviewedGaps(gaps, legallyReviewedKeys)).toEqual([
      "response.confirm.may_be_quoted",
    ]);
  });

  it("gir tom liste når ingen av hullene gjelder juridisk gjennomgått tekst", () => {
    const gaps = ["some.ordinary.key", "another.ordinary.key"];
    const legallyReviewedKeys = ["response.confirm.may_be_quoted"];

    expect(findLegallyReviewedGaps(gaps, legallyReviewedKeys)).toEqual([]);
  });
});
