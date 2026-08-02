// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HideResponseAction } from "./HideResponseAction";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("HideResponseAction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("krever ett bekreftende trykk til før skjuling faktisk fyrer", async () => {
    vi.stubGlobal("fetch", vi.fn());

    render(<HideResponseAction locale="nb-NO" responseId="response-1" />);

    await userEvent.click(screen.getByRole("button", { name: "Skjul svaret" }));

    expect(screen.getByRole("button", { name: "Bekreft skjuling" })).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("avbryter bekreftelsen uten å fyre kallet", async () => {
    vi.stubGlobal("fetch", vi.fn());

    render(<HideResponseAction locale="nb-NO" responseId="response-1" />);
    await userEvent.click(screen.getByRole("button", { name: "Skjul svaret" }));
    await userEvent.click(screen.getByRole("button", { name: "Avbryt" }));

    expect(screen.getByRole("button", { name: "Skjul svaret" })).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("viser en oversatt feilmelding når skjuling feiler, i stedet for å feile stille", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "errors.response_not_visible" }),
      })
    );

    render(<HideResponseAction locale="nb-NO" responseId="response-1" />);
    await userEvent.click(screen.getByRole("button", { name: "Skjul svaret" }));
    await userEvent.click(screen.getByRole("button", { name: "Bekreft skjuling" }));

    expect(await screen.findByText("Dette svaret er ikke synlig lenger.")).toBeInTheDocument();
  });

  it("viser en bekreftelse ved vellykket skjuling", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) }));

    render(<HideResponseAction locale="nb-NO" responseId="response-1" />);
    await userEvent.click(screen.getByRole("button", { name: "Skjul svaret" }));
    await userEvent.click(screen.getByRole("button", { name: "Bekreft skjuling" }));

    expect(await screen.findByText("Svaret er skjult.")).toBeInTheDocument();
  });
});
