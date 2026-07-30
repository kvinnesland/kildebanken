// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "./Select";

const COUNTRIES = [
  { id: "NO", label: "Norge" },
  { id: "SE", label: "Sverige" },
];

// React Aria kobler triggerknappens tilgjengelige navn til BÅDE
// `SelectValue`-teksten (placeholder eller valgt verdi) OG selve
// `<Label>`-teksten via `aria-labelledby`, i den rekkefølgen — derfor
// spørres det etter DEN ENE knappen i treet i stedet for et eksakt navn,
// og selve valgt/placeholder-teksten sjekkes separat.
describe("Select", () => {
  it("viser placeholder, ikke et forhåndsvalgt alternativ (SPEC-V1.md 7.1: ingenting avgjøres stille)", () => {
    render(<Select label="Land" options={COUNTRIES} />);
    const trigger = screen.getByRole("button");
    expect(within(trigger).queryByText("Norge")).not.toBeInTheDocument();
    expect(within(trigger).queryByText("Sverige")).not.toBeInTheDocument();
  });

  it("åpner listen, viser begge alternativene, og velger ett ved klikk", async () => {
    const onSelectionChange = vi.fn();
    render(<Select label="Land" options={COUNTRIES} onSelectionChange={onSelectionChange} />);

    await userEvent.click(screen.getByRole("button"));

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("Norge")).toBeInTheDocument();
    expect(within(listbox).getByText("Sverige")).toBeInTheDocument();

    await userEvent.click(within(listbox).getByText("Sverige"));

    expect(onSelectionChange).toHaveBeenCalledWith("SE");
    expect(within(screen.getByRole("button")).getByText("Sverige")).toBeInTheDocument();
  });

  it("er fokuserbar med tastatur og kan åpnes med Enter", async () => {
    render(<Select label="Land" options={COUNTRIES} />);

    await userEvent.tab();
    expect(screen.getByRole("button")).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("viser feiltekst kun når isInvalid er satt", () => {
    const { rerender } = render(
      <Select label="Land" options={COUNTRIES} errorMessage="Du må velge et land." />
    );
    expect(screen.queryByText("Du må velge et land.")).not.toBeInTheDocument();

    rerender(<Select label="Land" options={COUNTRIES} isInvalid errorMessage="Du må velge et land." />);
    expect(screen.getByText("Du må velge et land.")).toBeInTheDocument();
  });
});
