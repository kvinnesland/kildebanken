// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("knytter label til feltet (WCAG: alle felter skal ha et tilknyttet navn)", () => {
    render(<TextField label="E-postadresse" />);
    expect(screen.getByLabelText("E-postadresse")).toBeInTheDocument();
  });

  it("viser en beskrivelse knyttet via aria-describedby", () => {
    render(<TextField label="E-postadresse" description="Vi sender aldri denne videre." />);
    const input = screen.getByLabelText("E-postadresse");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(screen.getByText("Vi sender aldri denne videre.")).toBeInTheDocument();
  });

  it("DESIGN.md 6.1: en ugyldig verdi setter aria-invalid OG viser feiltekst ved feltet, knyttet med aria-describedby", () => {
    render(<TextField label="E-postadresse" isInvalid errorMessage="Dette er ikke en gyldig e-postadresse." />);

    const input = screen.getByLabelText("E-postadresse");
    expect(input).toHaveAttribute("aria-invalid", "true");

    const errorText = screen.getByText("Dette er ikke en gyldig e-postadresse.");
    expect(errorText).toBeInTheDocument();

    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(describedBy).toContain(errorText.id);
  });

  it("viser IKKE feiltekst når feltet er gyldig", () => {
    render(<TextField label="E-postadresse" errorMessage="Dette er ikke en gyldig e-postadresse." />);
    expect(screen.queryByText("Dette er ikke en gyldig e-postadresse.")).not.toBeInTheDocument();
  });
});
