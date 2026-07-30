// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("er IKKE avkrysset som standard (SPEC-V1.md 7.1: aldri forhåndsavkrysset)", () => {
    render(<Checkbox>Jeg samtykker</Checkbox>);
    expect(screen.getByRole("checkbox", { name: "Jeg samtykker" })).not.toBeChecked();
  });

  it("krysses av ved klikk, og av igjen ved et andre klikk", async () => {
    const onChange = vi.fn();
    render(<Checkbox onChange={onChange}>Jeg samtykker</Checkbox>);

    const checkbox = screen.getByRole("checkbox", { name: "Jeg samtykker" });
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(true);

    await userEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("er fokuserbar og kan krysses av med mellomrom-tasten (arvet tastaturhåndtering)", async () => {
    render(<Checkbox>Jeg samtykker</Checkbox>);

    await userEvent.tab();
    const checkbox = screen.getByRole("checkbox", { name: "Jeg samtykker" });
    expect(checkbox).toHaveFocus();

    await userEvent.keyboard(" ");
    expect(checkbox).toBeChecked();
  });

  it("viser feiltekst når isInvalid er satt, men ikke ellers", () => {
    const { rerender } = render(<Checkbox errorMessage="Du må krysse av her.">Jeg samtykker</Checkbox>);
    expect(screen.queryByText("Du må krysse av her.")).not.toBeInTheDocument();

    rerender(
      <Checkbox isInvalid errorMessage="Du må krysse av her.">
        Jeg samtykker
      </Checkbox>
    );
    expect(screen.getByText("Du må krysse av her.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Jeg samtykker" })).toHaveAttribute("aria-invalid", "true");
  });
});
