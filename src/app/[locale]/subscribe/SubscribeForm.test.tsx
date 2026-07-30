// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubscribeForm } from "./SubscribeForm";

const NORWAY = {
  code: "NO",
  nameKey: "country.no.name",
  defaultLocale: "nb-NO",
  availableLocales: ["nb-NO"],
  minimumAge: 18,
};

// Landet i selve testen har to tilgjengelige locales (i motsetning til det
// ekte NO-seed-datasettet, som bare har én) — nødvendig for å faktisk kunne
// utløse "bytt SPRÅK uten å bytte land"-nullstillingen (SPEC-V1.md 7.1) uten
// å dikte opp en ny land-i18n-nøkkel som ikke finnes i katalogen.
const NORWAY_WITH_TWO_LOCALES = { ...NORWAY, availableLocales: ["nb-NO", "en-GB"] };

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

async function fillOutCountryAndLocale() {
  const countrySelect = screen.getByRole("button", { name: /Land|Country/ });
  await userEvent.click(countrySelect);
  await userEvent.click(within(screen.getByRole("listbox")).getByText("Norge"));

  // Landet har bare én tilgjengelig locale — den forhåndsvelges automatisk
  // (SPEC-V1.md 7.1: forhåndsvalg er lov for land/språk, bare ikke samtykker).
  await waitFor(() => {
    expect(screen.getAllByRole("button").length).toBeGreaterThan(1);
  });
}

describe("SubscribeForm", () => {
  beforeEach(() => {
    mockFetchSequence([{ ok: true, body: { countries: [NORWAY] } }]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("henter land ved oppstart og viser dem i nedtrekkslisten", async () => {
    render(<SubscribeForm locale="nb-NO" />);

    const countrySelect = await screen.findByRole("button", { name: /Land/ });
    await userEvent.click(countrySelect);
    expect(within(screen.getByRole("listbox")).getByText("Norge")).toBeInTheDocument();
  });

  it("viser ikke samtykkene før land og språk er valgt (SPEC-V1.md 7.1)", async () => {
    render(<SubscribeForm locale="nb-NO" />);
    await screen.findByRole("button", { name: /Land/ });

    expect(
      screen.queryByText("Jeg samtykker til å motta den daglige e-posten med forespørsler.")
    ).not.toBeInTheDocument();

    await fillOutCountryAndLocale();

    expect(
      screen.getByText("Jeg samtykker til å motta den daglige e-posten med forespørsler.")
    ).toBeInTheDocument();
  });

  it("nullstiller samtykkene når SPRÅKET endres, uten å bytte land", async () => {
    vi.unstubAllGlobals();
    mockFetchSequence([{ ok: true, body: { countries: [NORWAY_WITH_TWO_LOCALES] } }]);

    render(<SubscribeForm locale="nb-NO" />);
    await screen.findByRole("button", { name: /Land/ });
    await fillOutCountryAndLocale();

    const emailConsent = screen.getByText(
      "Jeg samtykker til å motta den daglige e-posten med forespørsler."
    );
    await userEvent.click(emailConsent);
    expect(screen.getByText("Jeg samtykker til å motta den daglige e-posten med forespørsler.").closest("label")).toHaveAttribute(
      "data-selected"
    );

    // Landet har to tilgjengelige locales. jsdom sin standard `navigator.language`
    // ("en-US") gjør at "Engelsk" forhåndsvelges automatisk — bytt derfor til
    // den ANDRE tilgjengelige locale-en ("Norsk bokmål") for faktisk å utløse
    // en reell endring.
    const localeSelect = screen.getByRole("button", { name: /Språk/ });
    expect(localeSelect).toHaveTextContent("Engelsk");
    await userEvent.click(localeSelect);
    await userEvent.click(within(screen.getByRole("listbox")).getByText("Norsk bokmål"));

    await waitFor(() => {
      const resetConsent = screen.getByText(
        "Jeg samtykker til å motta den daglige e-posten med forespørsler."
      );
      expect(resetConsent.closest("label")).not.toHaveAttribute("data-selected");
    });
  });

  it("sender registreringen og viser suksessmelding", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) } as Response)
    );

    render(<SubscribeForm locale="nb-NO" />);
    await screen.findByRole("button", { name: /Land/ });
    await fillOutCountryAndLocale();

    await userEvent.type(screen.getByLabelText("E-postadresse"), "test@example.com");
    await userEvent.click(
      screen.getByText("Jeg samtykker til å motta den daglige e-posten med forespørsler.")
    );
    await userEvent.click(screen.getByText(/Jeg bekrefter at jeg er minst/));
    // Samtykketeksten for vilkår inneholder klikkbare lenker — klikk på selve
    // teksten utenfor lenkene for å krysse av boksen.
    await userEvent.click(screen.getByText(/Jeg godtar/));

    await userEvent.click(screen.getByRole("button", { name: "Registrer meg" }));

    expect(
      await screen.findByText(
        "Sjekk innboksen din — vi har sendt deg en lenke for å bekrefte e-postadressen."
      )
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/subscribe",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          countryCode: "NO",
          locale: "nb-NO",
          displayName: undefined,
          consentEmailSubscription: true,
          consentTerms: true,
          consentMinimumAge: true,
        }),
      })
    );
  });

  it("viser en oversatt feilmelding fra serveren ved mislykket registrering", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: "errors.email_already_registered" }),
      } as Response)
    );

    render(<SubscribeForm locale="nb-NO" />);
    await screen.findByRole("button", { name: /Land/ });
    await fillOutCountryAndLocale();

    await userEvent.type(screen.getByLabelText("E-postadresse"), "test@example.com");
    await userEvent.click(
      screen.getByText("Jeg samtykker til å motta den daglige e-posten med forespørsler.")
    );
    await userEvent.click(screen.getByText(/Jeg bekrefter at jeg er minst/));
    await userEvent.click(screen.getByText(/Jeg godtar/));

    await userEvent.click(screen.getByRole("button", { name: "Registrer meg" }));

    expect(
      await screen.findByText("Denne e-postadressen er allerede registrert.")
    ).toBeInTheDocument();
  });
});
