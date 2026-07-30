// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("viser tittel og forklaring", () => {
    render(<EmptyState title="Ingen forespørsler ennå" description="Nye forespørsler vises her." />);
    expect(screen.getByText("Ingen forespørsler ennå")).toBeInTheDocument();
    expect(screen.getByText("Nye forespørsler vises her.")).toBeInTheDocument();
  });

  it("viser en valgfri handling når den er satt", () => {
    render(
      <EmptyState
        title="Ingen forespørsler ennå"
        description="Nye forespørsler vises her."
        action={<button>Ny forespørsel</button>}
      />
    );
    expect(screen.getByRole("button", { name: "Ny forespørsel" })).toBeInTheDocument();
  });

  it("viser ingen handlingsseksjon når action ikke er satt", () => {
    const { container } = render(
      <EmptyState title="Ingen forespørsler ennå" description="Nye forespørsler vises her." />
    );
    expect(container.querySelectorAll("button, a").length).toBe(0);
  });
});
