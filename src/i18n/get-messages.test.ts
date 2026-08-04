import { describe, expect, it } from "vitest";
import { createTranslator, resolveMessage } from "./get-messages";

// SPEC-V1.md 21.3: "Alle strenger i ICU MessageFormat, med flertallsformer
// der det er relevant." journalist.inbox.total_label (en-GB) og
// journalist.inbox.contact_requests_label (begge språk) var hardkodede
// flertallsformer uansett antall — "1 responses total", "1 kontakt-
// forespørsler" — rettet under autonomt arbeid, se NATTLOGG.md.
describe("createTranslator — flertallsformer i journalist-innboksen (SPEC-V1.md 21.3)", () => {
  it("nb-NO: kontaktforespørsel-etiketten bøyes riktig for 1 og flere", () => {
    const t = createTranslator("nb-NO");
    expect(t("journalist.inbox.contact_requests_label", { count: 1 })).toBe("1 kontaktforespørsel");
    expect(t("journalist.inbox.contact_requests_label", { count: 2 })).toBe("2 kontaktforespørsler");
    expect(t("journalist.inbox.contact_requests_label", { count: 0 })).toBe("0 kontaktforespørsler");
  });

  it("en-GB: total- og kontaktforespørsel-etikettene bøyes riktig for 1 og flere", () => {
    const t = createTranslator("en-GB");
    expect(t("journalist.inbox.total_label", { count: 1 })).toBe("1 response total");
    expect(t("journalist.inbox.total_label", { count: 5 })).toBe("5 responses total");
    expect(t("journalist.inbox.contact_requests_label", { count: 1 })).toBe("1 contact request");
    expect(t("journalist.inbox.contact_requests_label", { count: 3 })).toBe("3 contact requests");
  });
});

// SPEC-V1.md 3.4: "forespurt locale → landets default_locale → plattformens
// standardspråk" — reelt hull frem til nå (se NATTLOGG.md): createTranslator()
// hoppet rett fra forespurt locale til plattformens standardspråk, og prøvde
// aldri landets eget default_locale i mellom. Rettet ved å la den bygge en
// kjede og delegere til resolveMessage(), som allerede implementerte hele
// 3.4-kjeden korrekt, men aldri ble faktisk kalt noe sted.
describe("createTranslator — landets default_locale som mellomledd (SPEC-V1.md 3.4)", () => {
  it("er identisk med den ettparameters-formen når intet countryDefaultLocale oppgis (bakoverkompatibilitet)", () => {
    const withoutSecondArg = createTranslator("nb-NO");
    const withSameLocaleTwice = createTranslator("nb-NO", "nb-NO");
    expect(withSameLocaleTwice("digest.intro")).toBe(withoutSecondArg("digest.intro"));
  });

  it("bruker fortsatt den forespurte locale-en når den faktisk har nøkkelen, uavhengig av countryDefaultLocale", () => {
    const t = createTranslator("en-GB", "nb-NO");
    expect(t("digest.intro")).not.toBe(createTranslator("nb-NO")("digest.intro"));
  });
});

describe("resolveMessage — 3.4 sin fulle fallback-kjede, ledd for ledd", () => {
  it("hopper over et ukjent/ustøttet locale-navn i kjeden og prøver neste ledd", () => {
    // "xx-XX" finnes ikke i SUPPORTED_LOCALES — isKnownLocale() filtrerer
    // det bort, akkurat som en fremtidig, delvis utrullet locale ville blitt
    // hoppet over i påvente av at det faktisk støttes.
    expect(resolveMessage("digest.intro", ["xx-XX", "nb-NO"])).toBe(
      resolveMessage("digest.intro", ["nb-NO"])
    );
  });

  it("faller til plattformens standardspråk når INGEN ledd i kjeden har nøkkelen, uten å vise en rå nøkkel", () => {
    const result = resolveMessage("dette.finnes.ikke.noe.sted", ["en-GB"]);
    expect(result).toBe("…");
    expect(result).not.toBe("dette.finnes.ikke.noe.sted");
  });
});
