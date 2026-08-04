// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequestEditForm } from "./RequestEditForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const INITIAL = {
  title: "En tittel",
  summary: "Et sammendrag",
  description: "En beskrivelse",
  targetPersonDescription: "Hvem som helst",
  topic: null,
  geographicNote: "",
  internalReference: "",
  contentLanguage: "nb-NO",
  responseDeadlineLocal: "2026-09-01T12:00",
  allowsAnonymousParticipation: true,
  mayBeRecorded: true,
  mayInvolvePhotoVideo: true,
};

describe("RequestEditForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // SPEC-V1.md 9.2 (FR-029): en avvist innsending pga. samtidighetsgrensen
  // skal "liste hvilke forespørsler journalisten må lukke først" — se
  // submitRequest() sin nye blockingRequests-verdi (requests.ts) og
  // NATTLOGG.md, økt 88.
  it("SPEC-V1.md 9.2: viser lenker til de blokkerende forespørslene når samtidighetsgrensen er nådd", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) })
      .mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            error: "errors.too_many_published_requests",
            blockingRequests: [
              { id: "req-1", title: "Første publiserte forespørsel" },
              { id: "req-2", title: "Andre publiserte forespørsel" },
            ],
          }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <RequestEditForm
        locale="nb-NO"
        requestId="draft-1"
        availableLocales={["nb-NO"]}
        timezone="Europe/Oslo"
        initial={INITIAL}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Send til vurdering" }));

    expect(
      await screen.findByText("Du har allerede for mange åpne forespørsler. Lukk én før du sender en ny.")
    ).toBeInTheDocument();
    expect(screen.getByText("Lukk én av disse for å fortsette:")).toBeInTheDocument();

    const firstLink = screen.getByRole("link", { name: "Første publiserte forespørsel" });
    expect(firstLink).toHaveAttribute("href", "/nb-NO/journalist/requests/req-1");
    const secondLink = screen.getByRole("link", { name: "Andre publiserte forespørsel" });
    expect(secondLink).toHaveAttribute("href", "/nb-NO/journalist/requests/req-2");
  });

  it("viser ingen lenkeliste for andre feil enn samtidighetsgrensen", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "errors.generic" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <RequestEditForm
        locale="nb-NO"
        requestId="draft-1"
        availableLocales={["nb-NO"]}
        timezone="Europe/Oslo"
        initial={INITIAL}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Send til vurdering" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Lukk én av disse for å fortsette:")).not.toBeInTheDocument();
  });
});
