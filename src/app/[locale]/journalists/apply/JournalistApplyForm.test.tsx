// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JournalistApplyForm } from "./JournalistApplyForm";

const NORWAY = {
  code: "NO",
  nameKey: "country.no.name",
  defaultLocale: "nb-NO",
  availableLocales: ["nb-NO"],
};

function mockFetchSequence(responses: Array<{ ok: boolean; body: unknown }>) {
  const fetchMock = vi.fn();
  for (const { ok, body } of responses) {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response)
    );
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function fillOutRequiredFields() {
  await userEvent.type(screen.getByLabelText("Fullt navn"), "Kari Journalist");
  await userEvent.type(screen.getByLabelText("Jobb-e-post"), "kari@avis.no");
  await userEvent.type(screen.getByLabelText("Stilling eller funksjon"), "Journalist");
  await userEvent.type(screen.getByLabelText("Redaksjon eller organisasjon"), "Avisa");
  await userEvent.type(screen.getByLabelText("Lenke til redaksjon"), "https://avisa.example");

  await userEvent.click(screen.getByRole("button", { name: /Land/ }));
  await userEvent.click(within(screen.getByRole("listbox")).getByText("Norge"));
}

describe("JournalistApplyForm", () => {
  beforeEach(() => {
    mockFetchSequence([{ ok: true, body: { countries: [NORWAY] } }]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("begrenser fullt navn, stilling og organisasjon til 200 tegn, samme grense som POST /journalists/apply håndhever server-side", async () => {
    render(<JournalistApplyForm locale="nb-NO" />);
    await screen.findByRole("button", { name: /Land/ });

    expect(screen.getByLabelText("Fullt navn")).toHaveAttribute("maxLength", "200");
    expect(screen.getByLabelText("Stilling eller funksjon")).toHaveAttribute("maxLength", "200");
    expect(screen.getByLabelText("Redaksjon eller organisasjon")).toHaveAttribute("maxLength", "200");
  });

  it("viser ikke samtykket før land og språk er valgt", async () => {
    render(<JournalistApplyForm locale="nb-NO" />);
    await screen.findByRole("button", { name: /Land/ });

    expect(screen.getByText("Velg et land først.")).toBeInTheDocument();

    await fillOutRequiredFields();

    expect(screen.queryByText("Velg et land først.")).not.toBeInTheDocument();
    expect(screen.getByText(/Jeg godtar/)).toBeInTheDocument();
  });

  it("sender søknaden og viser suksessmelding", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) } as Response)
    );

    render(<JournalistApplyForm locale="nb-NO" />);
    await screen.findByRole("button", { name: /Land/ });
    await fillOutRequiredFields();

    await userEvent.click(screen.getByText(/Jeg godtar/));
    await userEvent.click(screen.getByRole("button", { name: "Send søknad" }));

    expect(
      await screen.findByText(
        "Sjekk innboksen din — vi har sendt deg en lenke for å bekrefte e-postadressen. Søknaden din blir gjennomgått etter det."
      )
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/journalists/apply",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          fullName: "Kari Journalist",
          jobEmail: "kari@avis.no",
          jobTitle: "Journalist",
          organizationName: "Avisa",
          organizationUrl: "https://avisa.example",
          countryCode: "NO",
          locale: "nb-NO",
          consentJournalistTerms: true,
        }),
      })
    );
  });

  it("viser en oversatt feilmelding fra serveren ved mislykket søknad", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: "errors.email_already_registered" }),
      } as Response)
    );

    render(<JournalistApplyForm locale="nb-NO" />);
    await screen.findByRole("button", { name: /Land/ });
    await fillOutRequiredFields();
    await userEvent.click(screen.getByText(/Jeg godtar/));
    await userEvent.click(screen.getByRole("button", { name: "Send søknad" }));

    expect(
      await screen.findByText("Denne e-postadressen er allerede registrert.")
    ).toBeInTheDocument();
  });
});
