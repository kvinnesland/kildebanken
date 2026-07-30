import { describe, expect, it } from "vitest";
import {
  isJournalistRequestStatus,
  journalistRequestStatusTone,
  publicRequestStatusTone,
} from "./status-badge";

describe("publicRequestStatusTone", () => {
  it("published → success", () => {
    expect(publicRequestStatusTone("published")).toBe("success");
  });

  it("closed → neutral", () => {
    expect(publicRequestStatusTone("closed")).toBe("neutral");
  });

  it("expired → warning", () => {
    expect(publicRequestStatusTone("expired")).toBe("warning");
  });
});

describe("journalistRequestStatusTone", () => {
  it("changes_requested og rejected trenger oppmerksomhet, warning/danger", () => {
    expect(journalistRequestStatusTone("changes_requested")).toBe("warning");
    expect(journalistRequestStatusTone("rejected")).toBe("danger");
  });

  it("draft og submitted er nøytrale — ingenting galt, bare ikke publisert ennå", () => {
    expect(journalistRequestStatusTone("draft")).toBe("neutral");
    expect(journalistRequestStatusTone("submitted")).toBe("neutral");
  });
});

describe("isJournalistRequestStatus", () => {
  it("godtar alle sju statusene journalisten selv kan se", () => {
    for (const status of [
      "draft",
      "submitted",
      "changes_requested",
      "rejected",
      "published",
      "closed",
      "expired",
    ]) {
      expect(isJournalistRequestStatus(status)).toBe(true);
    }
  });

  it("avviser 'deleted' — listMineRequests() ekskluderer den allerede, skal aldri rendres", () => {
    expect(isJournalistRequestStatus("deleted")).toBe(false);
  });
});
