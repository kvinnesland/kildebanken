// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CountryCard } from "./CountryCard";

const baseCountry = {
  code: "XT",
  nameKey: "country.test.name",
  defaultLocale: "nb-NO",
  availableLocales: ["nb-NO", "en-GB"],
  timezone: "Europe/Oslo",
  minimumAge: 18,
  digestSendTime: "07:00",
  maxConcurrentPublishedRequests: 5,
  senderNameKey: "email.sender_name.test",
  supportEmail: "test@example.invalid",
  status: "draft" as const,
  statusLabel: "Kladd",
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("CountryCard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("viser feltene i visningsmodus, ikke et skjema, ved lasting", () => {
    render(
      <CountryCard
        locale="nb-NO"
        country={baseCountry}
        supportedLocales={["nb-NO", "en-GB"]}
        documents={[]}
      />
    );

    expect(screen.getByText("country.test.name")).toBeInTheDocument();
    expect(screen.queryByLabelText("Tidssone (IANA)")).not.toBeInTheDocument();
  });

  it("viser redigeringsskjemaet ved trykk på 'Rediger', forhåndsutfylt med gjeldende verdier", async () => {
    render(
      <CountryCard
        locale="nb-NO"
        country={baseCountry}
        supportedLocales={["nb-NO", "en-GB"]}
        documents={[]}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Rediger" }));

    expect(screen.getByLabelText("Tidssone (IANA)")).toHaveValue("Europe/Oslo");
  });

  it("viser en oversatt feilmelding når feltredigering feiler", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "errors.validation_failed" }),
      })
    );

    render(
      <CountryCard
        locale="nb-NO"
        country={baseCountry}
        supportedLocales={["nb-NO", "en-GB"]}
        documents={[]}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Rediger" }));
    await userEvent.click(screen.getByRole("button", { name: "Lagre endringer" }));

    expect(
      await screen.findByText("Ett eller flere felt mangler eller er ugyldige.")
    ).toBeInTheDocument();
  });

  it("viser en bekreftelse og går tilbake til visningsmodus ved vellykket feltredigering", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) }));

    render(
      <CountryCard
        locale="nb-NO"
        country={baseCountry}
        supportedLocales={["nb-NO", "en-GB"]}
        documents={[]}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Rediger" }));
    await userEvent.click(screen.getByRole("button", { name: "Lagre endringer" }));

    expect(await screen.findByText("Endringene er lagret.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Tidssone (IANA)")).not.toBeInTheDocument();
  });

  it("viser en oversatt feilmelding når statusbytte feiler (f.eks. manglende juridiske dokumenter)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "errors.legal_documents_unavailable" }),
      })
    );

    render(
      <CountryCard
        locale="nb-NO"
        country={baseCountry}
        supportedLocales={["nb-NO", "en-GB"]}
        documents={[]}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Sett status" }));

    expect(
      await screen.findByText("Denne kombinasjonen av land og språk er ikke klar for registrering ennå.")
    ).toBeInTheDocument();
  });

  it("viser en bekreftelse ved vellykket statusbytte", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) }));

    render(
      <CountryCard
        locale="nb-NO"
        country={baseCountry}
        supportedLocales={["nb-NO", "en-GB"]}
        documents={[]}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Sett status" }));

    expect(await screen.findByText("Status endret.")).toBeInTheDocument();
  });

  it("tildel moderator: krever en ikke-tom e-post, viser feilmelding ved mislykket kall, og bekreftelse ved suksess", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "errors.validation_failed" }),
      })
    );

    render(
      <CountryCard
        locale="nb-NO"
        country={baseCountry}
        supportedLocales={["nb-NO", "en-GB"]}
        documents={[]}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Tildel moderator" }));
    expect(screen.getByRole("button", { name: "Tildel" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("E-postadresse"), "existing-journalist@example.invalid");
    await userEvent.click(screen.getByRole("button", { name: "Tildel" }));

    expect(
      await screen.findByText("Ett eller flere felt mangler eller er ugyldige.")
    ).toBeInTheDocument();
  });

  it("viser eksisterende juridiske dokumenter fra props", () => {
    render(
      <CountryCard
        locale="nb-NO"
        country={baseCountry}
        supportedLocales={["nb-NO", "en-GB"]}
        documents={[{ id: "doc-1", rowLabel: "Vilkår (nb-NO), v1.0.0 — publisert 1. aug. 2026" }]}
      />
    );

    expect(screen.getByText("Vilkår (nb-NO), v1.0.0 — publisert 1. aug. 2026")).toBeInTheDocument();
  });
});
