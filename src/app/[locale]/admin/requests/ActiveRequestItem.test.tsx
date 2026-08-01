// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActiveRequestItem } from "./ActiveRequestItem";

const request = {
  id: "request-1",
  title: "En aktiv forespørsel",
  summary: "Et sammendrag",
  byLabel: "Kari Nordmann, Avisa",
  publishedAtLabel: "Publisert: 1. august 2026",
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("ActiveRequestItem", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("viser feltene, og krever ett bekreftende trykk til før lukking faktisk fyrer", async () => {
    vi.stubGlobal("fetch", vi.fn());

    render(<ActiveRequestItem locale="nb-NO" request={request} />);

    expect(screen.getByText("En aktiv forespørsel")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Lukk forespørselen" }));

    expect(screen.getByRole("button", { name: "Bekreft lukking" })).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("avbryter bekreftelsen uten å fyre kallet", async () => {
    vi.stubGlobal("fetch", vi.fn());

    render(<ActiveRequestItem locale="nb-NO" request={request} />);
    await userEvent.click(screen.getByRole("button", { name: "Lukk forespørselen" }));
    await userEvent.click(screen.getByRole("button", { name: "Avbryt" }));

    expect(screen.getByRole("button", { name: "Lukk forespørselen" })).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("viser en oversatt feilmelding når lukking feiler, i stedet for å feile stille", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "errors.request_not_open" }),
      })
    );

    render(<ActiveRequestItem locale="nb-NO" request={request} />);
    await userEvent.click(screen.getByRole("button", { name: "Lukk forespørselen" }));
    await userEvent.click(screen.getByRole("button", { name: "Bekreft lukking" }));

    expect(await screen.findByText("Denne forespørselen er ikke åpen.")).toBeInTheDocument();
  });

  it("viser en bekreftelse ved vellykket lukking", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) }));

    render(<ActiveRequestItem locale="nb-NO" request={request} />);
    await userEvent.click(screen.getByRole("button", { name: "Lukk forespørselen" }));
    await userEvent.click(screen.getByRole("button", { name: "Bekreft lukking" }));

    expect(await screen.findByText("Forespørselen er lukket.")).toBeInTheDocument();
  });
});
