import { describe, expect, it } from "vitest";
import {
  requestDetailPath,
  requestRespondPath,
  localeForRequestsSegment,
  requestsSegmentFor,
  respondSegmentFor,
  resolveLocalizedRequestPath,
  REQUESTS_FOLDER_SEGMENT,
  RESPOND_FOLDER_SEGMENT,
} from "./localized-paths";

describe("requestDetailPath", () => {
  it("bruker nb-NO sitt eget ord (foresporsler)", () => {
    expect(requestDetailPath("nb-NO", "req-1", "min-sak")).toBe("/nb-NO/foresporsler/req-1/min-sak");
  });

  it("bruker en-GB sitt eget, oversatte ord (requests)", () => {
    expect(requestDetailPath("en-GB", "req-1", "my-case")).toBe("/en-GB/requests/req-1/my-case");
  });
});

describe("requestRespondPath", () => {
  it("bruker nb-NO sitt eget ord for både forespørsel og svar", () => {
    expect(requestRespondPath("nb-NO", "req-1")).toBe("/nb-NO/foresporsler/req-1/svar");
  });

  it("bruker en-GB sine egne, oversatte ord for begge segmenter", () => {
    expect(requestRespondPath("en-GB", "req-1")).toBe("/en-GB/requests/req-1/respond");
  });
});

describe("localeForRequestsSegment", () => {
  it("gjenkjenner nb-NO sitt ord", () => {
    expect(localeForRequestsSegment("foresporsler")).toBe("nb-NO");
  });

  it("gjenkjenner en-GB sitt ord", () => {
    expect(localeForRequestsSegment("requests")).toBe("en-GB");
  });

  it("returnerer undefined for et ord som ikke tilhører noen locale", () => {
    expect(localeForRequestsSegment("something-else")).toBeUndefined();
  });
});

describe("requestsSegmentFor / respondSegmentFor", () => {
  it("nb-NO sine ord er de samme som det faktiske mappenavnet", () => {
    expect(requestsSegmentFor("nb-NO")).toBe(REQUESTS_FOLDER_SEGMENT);
    expect(respondSegmentFor("nb-NO")).toBe(RESPOND_FOLDER_SEGMENT);
  });

  it("en-GB sine ord er oversatt, ikke det samme som mappenavnet", () => {
    expect(requestsSegmentFor("en-GB")).not.toBe(REQUESTS_FOLDER_SEGMENT);
    expect(respondSegmentFor("en-GB")).not.toBe(RESPOND_FOLDER_SEGMENT);
  });
});

describe("resolveLocalizedRequestPath", () => {
  it("nb-NO sitt eget, riktige ord (foresporsler) — ingen handling, matcher allerede mappenavnet", () => {
    expect(resolveLocalizedRequestPath("/nb-NO/foresporsler/req-1/min-sak", "nb-NO")).toBeUndefined();
  });

  it("nb-NO sitt eget, riktige ord for svar — ingen handling", () => {
    expect(resolveLocalizedRequestPath("/nb-NO/foresporsler/req-1/svar", "nb-NO")).toBeUndefined();
  });

  it("en-GB sitt eget, riktige ord (requests) — rewrite til det faktiske mappenavnet, URL uendret", () => {
    expect(resolveLocalizedRequestPath("/en-GB/requests/req-1/my-slug", "en-GB")).toEqual({
      kind: "rewrite",
      pathname: "/en-GB/foresporsler/req-1/my-slug",
    });
  });

  it("en-GB sitt eget, riktige ord for svar (respond) — rewrite oversetter BEGGE segmentene", () => {
    expect(resolveLocalizedRequestPath("/en-GB/requests/req-1/respond", "en-GB")).toEqual({
      kind: "rewrite",
      pathname: "/en-GB/foresporsler/req-1/svar",
    });
  });

  it("nb-NO sitt ord brukt under en-GB (foresporsler) — redirect til en-GB sitt eget ord", () => {
    expect(resolveLocalizedRequestPath("/en-GB/foresporsler/req-1/my-slug", "en-GB")).toEqual({
      kind: "redirect",
      pathname: "/en-GB/requests/req-1/my-slug",
    });
  });

  it("nb-NO sitt svar-ord brukt under en-GB — redirect oversetter begge segmentene", () => {
    expect(resolveLocalizedRequestPath("/en-GB/foresporsler/req-1/svar", "en-GB")).toEqual({
      kind: "redirect",
      pathname: "/en-GB/requests/req-1/respond",
    });
  });

  it("en-GB sitt ord brukt under nb-NO (requests) — redirect til nb-NO sitt eget ord", () => {
    expect(resolveLocalizedRequestPath("/nb-NO/requests/req-1/my-slug", "nb-NO")).toEqual({
      kind: "redirect",
      pathname: "/nb-NO/foresporsler/req-1/my-slug",
    });
  });

  it("en-GB sitt svar-ord brukt under nb-NO — redirect oversetter begge segmentene", () => {
    expect(resolveLocalizedRequestPath("/nb-NO/requests/req-1/respond", "nb-NO")).toEqual({
      kind: "redirect",
      pathname: "/nb-NO/foresporsler/req-1/svar",
    });
  });

  it("bevarer en ekte slug uendret selv om den (usannsynlig) skulle inneholde et av respond-ordene som substreng", () => {
    // "svar-om-krigen" er ikke LIK "svar", bare skal ikke trigge noen
    // segment-4-oversettelse siden sammenligningen er eksakt, ikke prefiks.
    expect(resolveLocalizedRequestPath("/en-GB/requests/req-1/svar-om-krigen", "en-GB")).toEqual({
      kind: "rewrite",
      pathname: "/en-GB/foresporsler/req-1/svar-om-krigen",
    });
  });

  it("ikke en forespørsel-sti i det hele tatt — uendret", () => {
    expect(resolveLocalizedRequestPath("/en-GB/journalist/requests", "en-GB")).toBeUndefined();
    expect(resolveLocalizedRequestPath("/en-GB/admin/requests", "en-GB")).toBeUndefined();
    expect(resolveLocalizedRequestPath("/en-GB/me", "en-GB")).toBeUndefined();
  });

  it("for kort til å være en forespørsel-sti — uendret", () => {
    expect(resolveLocalizedRequestPath("/en-GB/requests", "en-GB")).toBeUndefined();
  });
});
