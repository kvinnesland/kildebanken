import { describe, expect, it } from "vitest";
import { publicRequestStatusTone } from "./status-badge";

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
