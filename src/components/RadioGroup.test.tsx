// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RadioGroup } from "./RadioGroup";

const CONTACT_SHARING_OPTIONS = [
  { value: "none", label: "Ikke del e-postadressen min ennå" },
  { value: "email", label: "Del e-postadressen min med journalisten" },
];

describe("RadioGroup", () => {
  it("viser ingen forhåndsvalgt alternativ når ingen value/defaultValue er satt", () => {
    render(<RadioGroup label="Kontaktinformasjon" options={CONTACT_SHARING_OPTIONS} />);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toBeChecked();
    }
  });

  it("SPEC-V1.md 12.2: 'none' er standardvalget når det faktisk settes eksplisitt av kalleren", () => {
    render(
      <RadioGroup label="Kontaktinformasjon" options={CONTACT_SHARING_OPTIONS} defaultValue="none" />
    );
    expect(screen.getByRole("radio", { name: "Ikke del e-postadressen min ennå" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Del e-postadressen min med journalisten" })).not.toBeChecked();
  });

  it("kan velges med klikk, og er gjensidig utelukkende", async () => {
    const onChange = vi.fn();
    render(
      <RadioGroup
        label="Kontaktinformasjon"
        options={CONTACT_SHARING_OPTIONS}
        defaultValue="none"
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole("radio", { name: "Del e-postadressen min med journalisten" }));

    expect(onChange).toHaveBeenCalledWith("email");
    expect(screen.getByRole("radio", { name: "Del e-postadressen min med journalisten" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Ikke del e-postadressen min ennå" })).not.toBeChecked();
  });

  it("er navigerbar med tastatur (piltaster mellom alternativene)", async () => {
    render(
      <RadioGroup label="Kontaktinformasjon" options={CONTACT_SHARING_OPTIONS} defaultValue="none" />
    );
    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Ikke del e-postadressen min ennå" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Del e-postadressen min med journalisten" })).toHaveFocus();
  });

  it("viser feiltekst kun når isInvalid er satt", () => {
    const { rerender } = render(
      <RadioGroup label="Kontaktinformasjon" options={CONTACT_SHARING_OPTIONS} errorMessage="Du må velge et alternativ." />
    );
    expect(screen.queryByText("Du må velge et alternativ.")).not.toBeInTheDocument();

    rerender(
      <RadioGroup
        label="Kontaktinformasjon"
        options={CONTACT_SHARING_OPTIONS}
        isInvalid
        errorMessage="Du må velge et alternativ."
      />
    );
    expect(screen.getByText("Du må velge et alternativ.")).toBeInTheDocument();
  });
});
