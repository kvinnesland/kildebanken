// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangeCountryForm } from "./ChangeCountryForm";

const NORWAY = {
  code: "NO",
  nameKey: "country.no.name",
  defaultLocale: "nb-NO",
  availableLocales: ["nb-NO"],
  minimumAge: 18,
};

function mockCountriesFetch() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ countries: [NORWAY] }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ChangeCountryForm", () => {
  beforeEach(() => {
    mockCountriesFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("DESIGN.md 6.1: flytter fokus til det første feilende feltet ved mislykket innsendingsforsøk", async () => {
    // Landet/språket forhåndsvelges automatisk til brukerens nåværende
    // verdier ved oppstart (se komponentens egen kommentar), så det eneste
    // feltet som faktisk mangler for et gyldig skjema her er samtykket —
    // derfor er det Checkbox-en som skal få fokus.
    render(<ChangeCountryForm locale="nb-NO" currentCountryCode="NO" currentLocale="nb-NO" />);

    await screen.findByRole("button", { name: "Bytt land" });
    await userEvent.click(screen.getByRole("button", { name: "Bytt land" }));

    await waitFor(() => expect(screen.getByRole("checkbox")).toHaveFocus());
  });

  it("sender endringen og viser en suksessmelding", async () => {
    const fetchMock = mockCountriesFetch();
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ countries: [NORWAY] }) });
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) });

    render(<ChangeCountryForm locale="nb-NO" currentCountryCode="NO" currentLocale="nb-NO" />);

    await screen.findByRole("button", { name: "Bytt land" });
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Bytt land" }));

    expect(
      await screen.findByText(
        "Landet ditt er byttet. Endringen gjelder fra neste utsendelse av den daglige e-posten."
      )
    ).toBeInTheDocument();
  });
});
