import { describe, expect, it } from "vitest";
import { mineResponseStatusTone } from "./status-badge";

describe("mineResponseStatusTone", () => {
  it("contact_requested trenger oppmerksomhet, warning", () => {
    expect(mineResponseStatusTone("contact_requested")).toBe("warning");
  });

  it("submitted/viewed/not_selected er nøytrale — ingen av dem er en feiltilstand", () => {
    expect(mineResponseStatusTone("submitted")).toBe("neutral");
    expect(mineResponseStatusTone("viewed")).toBe("neutral");
    expect(mineResponseStatusTone("not_selected")).toBe("neutral");
  });
});
