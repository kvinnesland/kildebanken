// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("krever en gyldig e-postadresse før innsending", async () => {
    render(<LoginForm locale="nb-NO" />);
    await userEvent.click(screen.getByRole("button", { name: "Send innloggingslenke" }));
    expect(screen.getByText("Dette feltet er obligatorisk.")).toBeInTheDocument();
  });

  it("DESIGN.md 6.1: flytter fokus til feltet ved mislykket valideringsforsøk", async () => {
    render(<LoginForm locale="nb-NO" />);
    await userEvent.click(screen.getByRole("button", { name: "Send innloggingslenke" }));
    await waitFor(() => expect(screen.getByLabelText("E-postadresse")).toHaveFocus());
  });

  it("viser suksessmelding etter innsending, uansett om kontoen finnes (SPEC-V1.md 6.1: avslører ingenting)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginForm locale="nb-NO" />);
    await userEvent.type(screen.getByLabelText("E-postadresse"), "test@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send innloggingslenke" }));

    expect(
      await screen.findByText(
        "Sjekk innboksen din — vi har sendt deg en lenke som er gyldig i 15 minutter."
      )
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/request-link",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ email: "test@example.com" }) })
    );
  });

  it("viser suksessmelding selv om selve nettverkskallet feiler (samme prinsipp — avslører ingenting, feiler aldri synlig)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    render(<LoginForm locale="nb-NO" />);
    await userEvent.type(screen.getByLabelText("E-postadresse"), "test@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send innloggingslenke" }));

    expect(
      await screen.findByText(
        "Sjekk innboksen din — vi har sendt deg en lenke som er gyldig i 15 minutter."
      )
    ).toBeInTheDocument();
  });
});
