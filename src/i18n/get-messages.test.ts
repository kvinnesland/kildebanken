import { describe, expect, it } from "vitest";
import { createTranslator } from "./get-messages";

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
