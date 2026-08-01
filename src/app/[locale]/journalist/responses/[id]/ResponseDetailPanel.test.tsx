// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResponseDetailPanel } from "./ResponseDetailPanel";

function renderPanel() {
  return render(
    <ResponseDetailPanel
      locale="nb-NO"
      responseId="response-1"
      initialMarking="unreviewed"
      initialNote=""
      showContactRequestForm={false}
    />
  );
}

describe("ResponseDetailPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lagrer merkingen og viser en bekreftelse ved suksess", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) }));

    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Lagre" }));

    expect(await screen.findByText("Lagret.")).toBeInTheDocument();
  });

  it("viser en oversatt feilmelding når lagring av merking feiler, i stedet for å feile stille", async () => {
    // Samme klasse taus feil som allerede rettet i admin-kø-komponentene og
    // NewRequestButton.tsx tidligere i natt — handleSendContactRequest() i
    // SAMME komponent viser allerede korrekt en feilmelding ved mislykket
    // sending, mens handleSaveMarking() ikke gjorde det i det hele tatt.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: "errors.not_found" }) })
    );

    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Lagre" }));

    expect(await screen.findByText("Fant ikke det du lette etter.")).toBeInTheDocument();
  });
});
