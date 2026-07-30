// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextArea } from "./TextArea";

describe("TextArea", () => {
  it("knytter label til feltet (WCAG: alle felter skal ha et tilknyttet navn)", () => {
    render(<TextArea label="Svar på journalistens spørsmål" />);
    expect(screen.getByLabelText("Svar på journalistens spørsmål")).toBeInTheDocument();
  });

  it("viser en beskrivelse knyttet via aria-describedby", () => {
    render(<TextArea label="Svar" description="Skriv så konkret du kan." />);
    const field = screen.getByLabelText("Svar");
    expect(field.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText("Skriv så konkret du kan.")).toBeInTheDocument();
  });

  it("DESIGN.md 6.1: en ugyldig verdi setter aria-invalid OG viser feiltekst ved feltet", () => {
    render(<TextArea label="Svar" isInvalid errorMessage="Dette feltet er obligatorisk." />);
    const field = screen.getByLabelText("Svar");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Dette feltet er obligatorisk.")).toBeInTheDocument();
  });

  it("viser IKKE feiltekst når feltet er gyldig", () => {
    render(<TextArea label="Svar" errorMessage="Dette feltet er obligatorisk." />);
    expect(screen.queryByText("Dette feltet er obligatorisk.")).not.toBeInTheDocument();
  });

  it("DESIGN.md 6: viser en tegnteller (brukt/grense) når maxLength er satt", () => {
    render(<TextArea label="Svar" value="hallo" maxLength={4000} onChange={() => {}} />);
    expect(screen.getByText("5/4000")).toBeInTheDocument();
  });

  it("viser INGEN tegnteller når maxLength ikke er satt", () => {
    render(<TextArea label="Svar" value="hallo" onChange={() => {}} />);
    expect(screen.queryByText(/\/\d+/)).not.toBeInTheDocument();
  });

  it("telleren oppdaterer seg live mens brukeren skriver (kontrollert felt)", async () => {
    function Wrapper() {
      const [value, setValue] = useState("");
      return <TextArea label="Svar" value={value} onChange={setValue} maxLength={10} />;
    }
    render(<Wrapper />);
    expect(screen.getByText("0/10")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Svar"), "hei");
    expect(screen.getByText("3/10")).toBeInTheDocument();
  });

  it("respekterer maxLength som en ekte HTML-håndhevelse (aria-live for skjermlesere)", () => {
    render(<TextArea label="Svar" value="" maxLength={4000} onChange={vi.fn()} />);
    const counter = screen.getByText("0/4000");
    expect(counter).toHaveAttribute("aria-live", "polite");
  });
});
