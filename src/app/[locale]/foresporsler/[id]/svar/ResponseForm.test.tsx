// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResponseForm } from "./ResponseForm";

function renderForm(sessionDisplayName: string | null = null) {
  return render(
    <ResponseForm
      locale="nb-NO"
      requestId="req-1"
      journalistName="Kari Journalist"
      organizationName="Avisa Eksempel"
      sessionEmail="respondent@example.com"
      sessionDisplayName={sessionDisplayName}
    />
  );
}

async function fillOutRequiredFields() {
  await userEvent.type(screen.getByLabelText("Hvorfor er du relevant?"), "Fordi jeg har relevant erfaring.");
  await userEvent.type(
    screen.getByLabelText("Svar på journalistens spørsmål"),
    "Her er svaret mitt på spørsmålet."
  );
}

describe("ResponseForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("krever relevans og svar før man kan gå videre til bekreftelse", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Gå videre til bekreftelse" }));
    expect(screen.queryByText("Bekreft innsending")).not.toBeInTheDocument();
    expect(screen.getAllByText("Dette feltet er obligatorisk.").length).toBeGreaterThan(0);
  });

  it("SPEC-V1.md 12.1: visningsnavnet forhåndsutfylles fra kontoen", () => {
    renderForm("Kari Nordmann");
    expect(screen.getByLabelText("Visningsnavn (valgfritt)")).toHaveValue("Kari Nordmann");
  });

  it("visningsnavnet er tomt når kontoen ikke har noe (skjemaet viser da eksempeltekst)", () => {
    renderForm(null);
    expect(screen.getByLabelText("Visningsnavn (valgfritt)")).toHaveValue("");
  });

  it("SPEC-V1.md 12.2: 'ikke del e-postadressen min' er standardvalget i bekreftelsen", async () => {
    renderForm();
    await fillOutRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: "Gå videre til bekreftelse" }));

    expect(screen.getByText("Bekreft innsending")).toBeInTheDocument();
    expect(
      screen.getByText("E-postadressen din deles IKKE med journalisten.")
    ).toBeInTheDocument();
  });

  it("viser respondentens e-post i bekreftelsen når e-postdeling velges", async () => {
    renderForm();
    await fillOutRequiredFields();
    await userEvent.click(screen.getByRole("radio", { name: "Del e-postadressen min med journalisten" }));
    await userEvent.click(screen.getByRole("button", { name: "Gå videre til bekreftelse" }));

    expect(
      screen.getByText("E-postadressen din (respondent@example.com) deles med journalisten.")
    ).toBeInTheDocument();
  });

  it("SPEC-V1.md 12.3: bekreftelsen viser journalist/redaksjon og at innsending ikke garanterer noe", async () => {
    renderForm();
    await fillOutRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: "Gå videre til bekreftelse" }));

    expect(
      screen.getByText("Svaret sendes til Kari Journalist (Avisa Eksempel).")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Innsending garanterer ikke kontakt eller publisering.")
    ).toBeInTheDocument();
  });

  it("'Tilbake og rediger' fører tilbake til skjemaet med verdiene bevart", async () => {
    renderForm();
    await fillOutRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: "Gå videre til bekreftelse" }));
    await userEvent.click(screen.getByRole("button", { name: "Tilbake og rediger" }));

    expect(
      screen.getByLabelText("Hvorfor er du relevant?")
    ).toHaveValue("Fordi jeg har relevant erfaring.");
  });

  it("sender svaret og viser en suksessmelding", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "resp-1" }) });
    vi.stubGlobal("fetch", fetchMock);

    renderForm();
    await fillOutRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: "Gå videre til bekreftelse" }));
    await userEvent.click(screen.getByRole("button", { name: "Bekreft og send" }));

    expect(await screen.findByText("Svaret ditt er sendt. Du får en kvittering på e-post.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/requests/req-1/responses",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          relevanceStatement: "Fordi jeg har relevant erfaring.",
          answerText: "Her er svaret mitt på spørsmålet.",
          shortBio: undefined,
          displayName: undefined,
          contactSharing: "none",
        }),
      })
    );
  });

  it("viser en oversatt feilmelding fra serveren ved mislykket innsending", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "errors.already_responded" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderForm();
    await fillOutRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: "Gå videre til bekreftelse" }));
    await userEvent.click(screen.getByRole("button", { name: "Bekreft og send" }));

    expect(
      await screen.findByText("Du har allerede sendt et svar på denne forespørselen.")
    ).toBeInTheDocument();
  });
});
