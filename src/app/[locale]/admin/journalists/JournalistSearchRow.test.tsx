// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JournalistSearchRow } from "./JournalistSearchRow";

const activeJournalist = {
  userId: "journalist-1",
  email: "journalist@example.invalid",
  status: "active" as const,
  statusLabel: "Aktiv",
  fullName: "Kari Journalist",
  jobTitle: "Journalist",
  organizationName: "Testavisen",
  organizationUrl: "https://example.invalid",
  verificationStatusLabel: "godkjent",
  pastRequestsLabel: "2 tidligere forespørsler",
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("JournalistSearchRow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("viser profilinfo, status og antall tidligere forespørsler", () => {
    render(<JournalistSearchRow locale="nb-NO" journalist={activeJournalist} />);

    expect(screen.getByText("Kari Journalist")).toBeInTheDocument();
    expect(screen.getByText(/Aktiv/)).toBeInTheDocument();
    expect(screen.getByText(/2 tidligere forespørsler/)).toBeInTheDocument();
  });

  it("deaktiverer 'Opphev suspensjon' for en ikke-suspendert konto", () => {
    render(<JournalistSearchRow locale="nb-NO" journalist={activeJournalist} />);

    expect(screen.getByRole("button", { name: "Opphev suspensjon" })).toBeDisabled();
  });

  it("krever en ikke-tom begrunnelse før suspensjon kan bekreftes", async () => {
    render(<JournalistSearchRow locale="nb-NO" journalist={activeJournalist} />);

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

    render(<JournalistSearchRow locale="nb-NO" journalist={activeJournalist} />);
    await userEvent.click(screen.getByRole("button", { name: "Suspender" }));
    await userEvent.type(screen.getByLabelText("Begrunnelse"), "Misbruk rapportert.");
    await userEvent.click(screen.getByRole("button", { name: "Bekreft suspensjon" }));

    expect(await screen.findByText("Du har ikke tilgang til å gjøre dette.")).toBeInTheDocument();
  });

  it("suspenderer og viser en bekreftelse ved suksess", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) }));

    render(<JournalistSearchRow locale="nb-NO" journalist={activeJournalist} />);
    await userEvent.click(screen.getByRole("button", { name: "Suspender" }));
    await userEvent.type(screen.getByLabelText("Begrunnelse"), "Misbruk rapportert.");
    await userEvent.click(screen.getByRole("button", { name: "Bekreft suspensjon" }));

    expect(await screen.findByText("Kontoen er suspendert.")).toBeInTheDocument();
  });

  it("opphever suspensjon direkte (ingen begrunnelse kreves) og viser en bekreftelse", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) }));

    render(
      <JournalistSearchRow
        locale="nb-NO"
        journalist={{ ...activeJournalist, status: "suspended", statusLabel: "Suspendert" }}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Opphev suspensjon" }));

    expect(await screen.findByText("Suspensjonen er opphevet.")).toBeInTheDocument();
  });

  it("viser en oversatt feilmelding når oppheving av suspensjon feiler", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "errors.validation_failed" }),
      })
    );

    render(
      <JournalistSearchRow
        locale="nb-NO"
        journalist={{ ...activeJournalist, status: "suspended", statusLabel: "Suspendert" }}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Opphev suspensjon" }));

    expect(
      await screen.findByText("Ett eller flere felt mangler eller er ugyldige.")
    ).toBeInTheDocument();
  });
});
