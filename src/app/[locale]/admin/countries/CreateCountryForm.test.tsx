// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateCountryForm } from "./CreateCountryForm";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

describe("CreateCountryForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("er kollapset ved lasting, og utvider skjemaet ved trykk på 'Nytt land'", async () => {
    render(<CreateCountryForm locale="nb-NO" />);

    expect(screen.queryByLabelText("Landkode (ISO 3166-1 alpha-2)")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Nytt land" }));

    expect(screen.getByLabelText("Landkode (ISO 3166-1 alpha-2)")).toBeInTheDocument();
  });

  it("krever et standardspråk blant de HUKEDE tilgjengelige språkene før innsending kan fyre", async () => {
    render(<CreateCountryForm locale="nb-NO" />);
    await userEvent.click(screen.getByRole("button", { name: "Nytt land" }));

    // Ingen språk er hukt av ennå — standardspråk-velgeren skal derfor ikke
    // ha noe å velge blant, og innsendingsknappen skal forbli deaktivert.
    expect(screen.getByRole("button", { name: "Opprett" })).toBeDisabled();
  });

  it("viser en oversatt feilmelding når opprettelse feiler, i stedet for å feile stille", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "errors.already_exists" }),
      })
    );

    render(<CreateCountryForm locale="nb-NO" />);
    await userEvent.click(screen.getByRole("button", { name: "Nytt land" }));
    await userEvent.type(screen.getByLabelText("Landkode (ISO 3166-1 alpha-2)"), "zz");
    await userEvent.type(screen.getByLabelText("Navn (i18n-nøkkel)", { exact: true }), "country.test.name");
    await userEvent.click(screen.getByRole("checkbox", { name: "Norsk bokmål" }));
    await userEvent.click(screen.getByLabelText("Standardspråk"));
    await userEvent.click(screen.getByRole("option", { name: "Norsk bokmål" }));
    await userEvent.type(screen.getByLabelText("Tidssone (IANA)"), "Europe/Oslo");
    await userEvent.type(
      screen.getByLabelText("Avsendernavn (i18n-nøkkel)", { exact: true }),
      "email.sender_name.test"
    );
    await userEvent.type(screen.getByLabelText("Support-e-post", { exact: true }), "support@example.invalid");
    await userEvent.click(screen.getByRole("button", { name: "Opprett" }));

    expect(await screen.findByText("Dette finnes allerede.")).toBeInTheDocument();
  });

  it("viser en bekreftelse etter vellykket opprettelse", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) }));

    render(<CreateCountryForm locale="nb-NO" />);
    await userEvent.click(screen.getByRole("button", { name: "Nytt land" }));
    await userEvent.type(screen.getByLabelText("Landkode (ISO 3166-1 alpha-2)"), "zz");
    await userEvent.type(screen.getByLabelText("Navn (i18n-nøkkel)", { exact: true }), "country.test.name");
    await userEvent.click(screen.getByRole("checkbox", { name: "Norsk bokmål" }));
    await userEvent.click(screen.getByLabelText("Standardspråk"));
    await userEvent.click(screen.getByRole("option", { name: "Norsk bokmål" }));
    await userEvent.type(screen.getByLabelText("Tidssone (IANA)"), "Europe/Oslo");
    await userEvent.type(
      screen.getByLabelText("Avsendernavn (i18n-nøkkel)", { exact: true }),
      "email.sender_name.test"
    );
    await userEvent.type(screen.getByLabelText("Support-e-post", { exact: true }), "support@example.invalid");
    await userEvent.click(screen.getByRole("button", { name: "Opprett" }));

    expect(await screen.findByText("Landet er opprettet (status: kladd).")).toBeInTheDocument();
  });
});
