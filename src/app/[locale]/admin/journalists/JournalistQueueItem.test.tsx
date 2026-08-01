// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JournalistQueueItem } from "./JournalistQueueItem";

const journalist = {
  userId: "journalist-1",
  fullName: "Kari Nordmann",
  jobTitle: "Journalist",
  organizationName: "Avisa",
  organizationUrl: "https://avisa.example",
  appliedLabel: "Søkte 1. august 2026",
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("JournalistQueueItem", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("viser en oversatt feilmelding når godkjenning feiler i stedet for å feile stille", async () => {
    // Feilkoden her (journalist_not_pending_review) er nøyaktig den
    // approveJournalist() returnerer når to moderatorer behandler samme
    // søknad samtidig (TOCTOU-fiksen, se NATTLOGG.md) — uten denne
    // visningen fikk admin ingen tilbakemelding overhodet ved en slik
    // konflikt.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "errors.journalist_not_pending_review" }),
      })
    );

    render(<JournalistQueueItem locale="nb-NO" journalist={journalist} />);
    await userEvent.click(screen.getByRole("button", { name: "Godkjenn" }));

    expect(await screen.findByText("Denne søknaden er allerede behandlet.")).toBeInTheDocument();
  });

  it("viser en oversatt feilmelding når avvisning feiler", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "errors.journalist_not_pending_review" }),
      })
    );

    render(<JournalistQueueItem locale="nb-NO" journalist={journalist} />);
    await userEvent.click(screen.getByRole("button", { name: "Avvis" }));
    await userEvent.type(screen.getByLabelText("Begrunnelse (sendes til søkeren)"), "En begrunnelse");
    await userEvent.click(screen.getByRole("button", { name: "Send avvisning" }));

    expect(await screen.findByText("Denne søknaden er allerede behandlet.")).toBeInTheDocument();
  });

  it("godkjenner og viser en bekreftelse ved suksess", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) }));

    render(<JournalistQueueItem locale="nb-NO" journalist={journalist} />);
    await userEvent.click(screen.getByRole("button", { name: "Godkjenn" }));

    expect(await screen.findByText("Godkjent.")).toBeInTheDocument();
  });
});
