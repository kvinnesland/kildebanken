// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteHeader } from "./SiteHeader";

// SiteHeader rendrer både LogoutButton (useRouter()) og LanguageSwitcher
// (usePathname()) — begge trenger next/navigation mocket her siden ingen
// av dem er isolert i denne testen.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/nb-NO/journalist/requests",
}));

describe("SiteHeader", () => {
  it("viser hjemlenken, de oppgitte navigasjonslenkene, og logg ut-knappen", () => {
    render(
      <SiteHeader
        locale="nb-NO"
        navLinks={[
          { href: "/nb-NO/journalist/requests", label: "Mine forespørsler" },
          { href: "/nb-NO/me", label: "Min konto" },
        ]}
      />
    );

    expect(screen.getByRole("link", { name: "Forsiden" })).toHaveAttribute("href", "/nb-NO");
    expect(screen.getByRole("link", { name: "Mine forespørsler" })).toHaveAttribute(
      "href",
      "/nb-NO/journalist/requests"
    );
    expect(screen.getByRole("link", { name: "Min konto" })).toHaveAttribute("href", "/nb-NO/me");
    expect(screen.getByRole("button", { name: "Logg ut" })).toBeInTheDocument();
  });

  it("viser ingen navigasjonslenker når ingen er oppgitt, uten å feile", () => {
    render(<SiteHeader locale="nb-NO" navLinks={[]} />);

    expect(screen.getByRole("link", { name: "Forsiden" })).toBeInTheDocument();
    // To <nav>-elementer finnes (SiteHeader sin egen, og LanguageSwitcher
    // sin egen, aria-label="Språk") — SiteHeader sin egen er den UTEN navn,
    // og skal være tom når navLinks er en tom liste.
    const unnamedNav = screen.getAllByRole("navigation").find((nav) => !nav.hasAttribute("aria-label"));
    expect(unnamedNav).toBeEmptyDOMElement();
  });
});
