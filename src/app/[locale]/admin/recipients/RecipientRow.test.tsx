// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecipientRow } from "./RecipientRow";

const activeUser = {
  id: "recipient-1",
  email: "recipient@example.invalid",
  status: "active" as const,
  statusLabel: "Aktiv",
  createdLabel: "1. august 2026",
  consentLines: ["e-postabonnement: gitt (1. august 2026)"],
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("RecipientRow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("viser e-post, status og samtykkehistorikk", () => {
    render(<RecipientRow locale="nb-NO" user={activeUser} />);

    expect(screen.getByText("recipient@example.invalid")).toBeInTheDocument();
    expect(screen.getByText(/Aktiv/)).toBeInTheDocument();
    expect(screen.getByText("e-postabonnement: gitt (1. august 2026)")).toBeInTheDocument();
  });

  it("krever en ikke-tom begrunnelse før suspensjon kan bekreftes", async () => {
    render(<RecipientRow locale="nb-NO" user={activeUser} />);

    await userEvent.click(screen.getByRole("button", { name: "Suspender" }));
    expect(screen.getByRole("button", { name: "Bekreft suspensjon" })).toBeDisabled();
  });

  it("viser en oversatt feilmelding når suspensjon feiler, i stedet for å feile stille", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "errors.not_authorized" }),
      })
    );

    render(<RecipientRow locale="nb-NO" user={activeUser} />);
    await userEvent.click(screen.getByRole("button", { name: "Suspender" }));
    await userEvent.type(screen.getByLabelText("Begrunnelse"), "Misbruk rapportert.");
    await userEvent.click(screen.getByRole("button", { name: "Bekreft suspensjon" }));

    expect(await screen.findByText("Du har ikke tilgang til å gjøre dette.")).toBeInTheDocument();
  });

  it("suspenderer og viser en bekreftelse ved suksess", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) }));

    render(<RecipientRow locale="nb-NO" user={activeUser} />);
    await userEvent.click(screen.getByRole("button", { name: "Suspender" }));
    await userEvent.type(screen.getByLabelText("Begrunnelse"), "Misbruk rapportert.");
    await userEvent.click(screen.getByRole("button", { name: "Bekreft suspensjon" }));

    expect(await screen.findByText("Kontoen er suspendert.")).toBeInTheDocument();
  });

  it("krever et eksplisitt bekreftelsestrinn før sletting fyrer, ikke ved første trykk", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<RecipientRow locale="nb-NO" user={activeUser} />);
    await userEvent.click(screen.getByRole("button", { name: "Slett kontoen" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/kan ikke angres/)).toBeInTheDocument();
  });

  it("viser en oversatt feilmelding når sletting feiler", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "errors.validation_failed" }),
      })
    );

    render(<RecipientRow locale="nb-NO" user={activeUser} />);
    await userEvent.click(screen.getByRole("button", { name: "Slett kontoen" }));
    await userEvent.click(screen.getByRole("button", { name: "Ja, slett kontoen" }));

    expect(
      await screen.findByText("Ett eller flere felt mangler eller er ugyldige.")
    ).toBeInTheDocument();
  });

  it("sletter og viser en bekreftelse etter det andre (eksplisitte) trykket", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) }));

    render(<RecipientRow locale="nb-NO" user={activeUser} />);
    await userEvent.click(screen.getByRole("button", { name: "Slett kontoen" }));
    await userEvent.click(screen.getByRole("button", { name: "Ja, slett kontoen" }));

    expect(await screen.findByText("Kontoen er slettet.")).toBeInTheDocument();
  });

  it("deaktiverer BEGGE handlingene for en allerede slettet konto", () => {
    render(
      <RecipientRow
        locale="nb-NO"
        user={{ ...activeUser, status: "deleted", statusLabel: "Slettet" }}
      />
    );

    expect(screen.getByRole("button", { name: "Suspender" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Slett kontoen" })).toBeDisabled();
  });
});
