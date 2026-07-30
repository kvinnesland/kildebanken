// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

describe("Card", () => {
  it("viser en valgfri tittel", () => {
    render(<Card title="Norge">Innhold</Card>);
    expect(screen.getByRole("heading", { name: "Norge" })).toBeInTheDocument();
    expect(screen.getByText("Innhold")).toBeInTheDocument();
  });

  it("viser INGEN overskrift når tittel ikke er satt", () => {
    render(<Card>Innhold uten tittel</Card>);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
