// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LegalDocumentsSection } from "./LegalDocumentsSection";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("LegalDocumentsSection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("viser tomtekst når ingen dokumenter finnes ennå", () => {
    render(
      <LegalDocumentsSection locale="nb-NO" countryCode="XT" availableLocales={["nb-NO"]} documents={[]} />
    );

    expect(screen.getByText("Ingen publiserte dokumenter ennå.")).toBeInTheDocument();
  });

  it("lister eksisterende dokumenter fra props", () => {
    render(
      <LegalDocumentsSection
        locale="nb-NO"
        countryCode="XT"
        availableLocales={["nb-NO"]}
        documents={[{ id: "doc-1", rowLabel: "Vilkår (nb-NO), v1.0.0 — publisert 1. aug. 2026" }]}
      />
    );

    expect(screen.getByText("Vilkår (nb-NO), v1.0.0 — publisert 1. aug. 2026")).toBeInTheDocument();
  });

  it("skjemaet er kollapset ved lasting, og utvides ved trykk på 'Publiser ny versjon'", async () => {
    render(
      <LegalDocumentsSection locale="nb-NO" countryCode="XT" availableLocales={["nb-NO"]} documents={[]} />
    );

    expect(screen.queryByLabelText("Versjon")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Publiser ny versjon" }));
    expect(screen.getByLabelText("Versjon")).toBeInTheDocument();
  });

  it("krever alle feltene før publisering kan fyre", async () => {
    render(
      <LegalDocumentsSection locale="nb-NO" countryCode="XT" availableLocales={["nb-NO"]} documents={[]} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Publiser ny versjon" }));

    expect(screen.getByRole("button", { name: "Publiser" })).toBeDisabled();
  });

  it("viser en oversatt feilmelding når publisering feiler, i stedet for å feile stille", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "errors.already_exists" }),
      })
    );

    render(
      <LegalDocumentsSection locale="nb-NO" countryCode="XT" availableLocales={["nb-NO"]} documents={[]} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Publiser ny versjon" }));
    await userEvent.click(screen.getByLabelText("Språk"));
    await userEvent.click(screen.getByRole("option", { name: "nb-NO" }));
    await userEvent.click(screen.getByLabelText("Dokumenttype"));
    await userEvent.click(screen.getByRole("option", { name: "Vilkår" }));
    await userEvent.type(screen.getByLabelText("Versjon"), "1.0.0");
    await userEvent.type(screen.getByLabelText("Innhold"), "Testinnhold.");
    await userEvent.click(screen.getByRole("button", { name: "Publiser" }));

    expect(await screen.findByText("Dette finnes allerede.")).toBeInTheDocument();
  });

  it("viser en bekreftelse ved vellykket publisering", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) }));

    render(
      <LegalDocumentsSection locale="nb-NO" countryCode="XT" availableLocales={["nb-NO"]} documents={[]} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Publiser ny versjon" }));
    await userEvent.click(screen.getByLabelText("Språk"));
    await userEvent.click(screen.getByRole("option", { name: "nb-NO" }));
    await userEvent.click(screen.getByLabelText("Dokumenttype"));
    await userEvent.click(screen.getByRole("option", { name: "Vilkår" }));
    await userEvent.type(screen.getByLabelText("Versjon"), "1.0.0");
    await userEvent.type(screen.getByLabelText("Innhold"), "Testinnhold.");
    await userEvent.click(screen.getByRole("button", { name: "Publiser" }));

    expect(await screen.findByText("Ny versjon publisert.")).toBeInTheDocument();
  });
});
