// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDeletionClient } from "./ConfirmDeletionClient";

// Samme mock-mønster som LogoutButton.test.tsx.
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

describe("ConfirmDeletionClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    searchParams = new URLSearchParams();
  });

  it("fyrer IKKE sletting automatisk ved innlasting — krever et eksplisitt knappetrykk først", async () => {
    // Den reelle feilen denne testen beviser er rettet: den forrige
    // versjonen kalte fetch() automatisk i en useEffect ved mount, uten at
    // noen bruker (eller en e-postsikkerhetsskanner som forhåndsbesøker
    // lenken) trengte å gjøre noe som helst. Se NATTLOGG.md.
    searchParams = new URLSearchParams({ token: "et-gyldig-token" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<ConfirmDeletionClient locale="nb-NO" />);

    expect(screen.getByText("Er du sikker på at du vil slette kontoen din? Dette kan ikke angres.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sender bekreftelseskallet FØRST når knappen trykkes, og viser suksess", async () => {
    searchParams = new URLSearchParams({ token: "et-gyldig-token" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<ConfirmDeletionClient locale="nb-NO" />);
    await userEvent.click(screen.getByRole("button", { name: "Ja, slett kontoen min permanent" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/me/confirm-deletion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "et-gyldig-token" }),
    });
    expect(await screen.findByText("Kontoen din er slettet.")).toBeInTheDocument();
  });

  it("viser feilmelding umiddelbart når ingen token finnes i det hele tatt — uten å kalle fetch", () => {
    searchParams = new URLSearchParams();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ConfirmDeletionClient locale="nb-NO" />);

    expect(
      screen.getByText(
        "Lenken er ugyldig eller har utløpt. Be om en ny sletting fra kontosiden din hvis du fortsatt ønsker å slette kontoen."
      )
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("viser feilmelding dersom bekreftelseskallet feiler etter at knappen trykkes", async () => {
    searchParams = new URLSearchParams({ token: "et-utlopt-token" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    render(<ConfirmDeletionClient locale="nb-NO" />);
    await userEvent.click(screen.getByRole("button", { name: "Ja, slett kontoen min permanent" }));

    expect(
      await screen.findByText(
        "Lenken er ugyldig eller har utløpt. Be om en ny sletting fra kontosiden din hvis du fortsatt ønsker å slette kontoen."
      )
    ).toBeInTheDocument();
  });
});
