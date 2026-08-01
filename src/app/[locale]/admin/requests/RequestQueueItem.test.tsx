// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequestQueueItem } from "./RequestQueueItem";

const request = {
  id: "request-1",
  title: "En forespørsel",
  summary: "Et sammendrag",
  description: "En beskrivelse",
  targetPersonDescription: "En beskrivelse av personen",
  byLabel: "Kari Nordmann, Avisa",
  deadlineLabel: "Svarfrist: 1. august 2026",
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("RequestQueueItem", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("viser en oversatt feilmelding når publisering feiler i stedet for å feile stille", async () => {
    // Feilkoden her (request_not_editable) er nøyaktig den publishRequest()
    // returnerer når forespørselen alt er behandlet av en annen moderator i
    // mellomtiden (TOCTOU-fiksen, se NATTLOGG.md).
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "errors.request_not_editable" }),
      })
    );

    render(<RequestQueueItem locale="nb-NO" request={request} />);
    await userEvent.click(screen.getByRole("button", { name: "Godkjenn og publiser" }));

    expect(await screen.findByText("Denne forespørselen kan ikke redigeres nå.")).toBeInTheDocument();
  });

  it("viser en oversatt feilmelding når avvisning feiler", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "errors.request_not_editable" }),
      })
    );

    render(<RequestQueueItem locale="nb-NO" request={request} />);
    await userEvent.click(screen.getByRole("button", { name: "Avvis" }));
    await userEvent.type(screen.getByLabelText("Begrunnelse (sendes til journalisten)"), "En begrunnelse");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Denne forespørselen kan ikke redigeres nå.")).toBeInTheDocument();
  });

  it("viser en oversatt feilmelding når endringsforespørsel feiler", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "errors.request_not_editable" }),
      })
    );

    render(<RequestQueueItem locale="nb-NO" request={request} />);
    await userEvent.click(screen.getByRole("button", { name: "Be om endringer" }));
    await userEvent.type(screen.getByLabelText("Kommentar (sendes til journalisten)"), "En kommentar");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Denne forespørselen kan ikke redigeres nå.")).toBeInTheDocument();
  });

  it("publiserer og viser en bekreftelse ved suksess", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) }));

    render(<RequestQueueItem locale="nb-NO" request={request} />);
    await userEvent.click(screen.getByRole("button", { name: "Godkjenn og publiser" }));

    expect(await screen.findByText("Publisert.")).toBeInTheDocument();
  });
});
