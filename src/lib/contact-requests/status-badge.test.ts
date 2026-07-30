import { describe, expect, it } from "vitest";
import { contactRequestStatusTone } from "./status-badge";

describe("contactRequestStatusTone", () => {
  it("pending trenger oppmerksomhet (respondenten har ikke svart ennå), warning", () => {
    expect(contactRequestStatusTone("pending")).toBe("warning");
  });

  it("approved er positivt, success", () => {
    expect(contactRequestStatusTone("approved")).toBe("success");
  });

  it("declined/expired/cancelled er avsluttede tilstander uten videre handling, nøytrale", () => {
    expect(contactRequestStatusTone("declined")).toBe("neutral");
    expect(contactRequestStatusTone("expired")).toBe("neutral");
    expect(contactRequestStatusTone("cancelled")).toBe("neutral");
  });
});
