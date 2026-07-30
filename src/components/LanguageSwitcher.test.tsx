// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageSwitcher } from "./LanguageSwitcher";

// Første komponent i kodebasen som bruker next/navigation sin usePathname()
// — ingen etablert mock-konvensjon fantes fra før, så denne setter den:
// mock hele modulen, returner en fast sti, verifiser at komponenten bruker
// den til å bygge lenkene sine.
vi.mock("next/navigation", () => ({
  usePathname: () => "/nb-NO/journalist/requests",
}));

describe("LanguageSwitcher", () => {
  it("viser begge locales med riktig lenke, og markerer gjeldende locale", () => {
    render(<LanguageSwitcher locale="nb-NO" />);

    const nb = screen.getByRole("link", { name: "Norsk bokmål" });
    const en = screen.getByRole("link", { name: "Engelsk" });

    expect(nb).toHaveAttribute("href", "/nb-NO/journalist/requests");
    expect(en).toHaveAttribute("href", "/en-GB/journalist/requests");
    expect(nb).toHaveAttribute("aria-current", "true");
    expect(en).not.toHaveAttribute("aria-current");
  });

  it("bytter BARE locale-segmentet, beholder resten av stien uendret (SPEC-V1.md 3.7)", () => {
    render(<LanguageSwitcher locale="nb-NO" />);
    expect(screen.getByRole("link", { name: "Engelsk" })).toHaveAttribute(
      "href",
      "/en-GB/journalist/requests"
    );
  });
});
