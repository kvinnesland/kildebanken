// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewRequestButton } from "./NewRequestButton";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("NewRequestButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    pushMock.mockClear();
  });

  it("navigerer til det nye utkastet ved suksess", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "req-1" }) })
    );

    render(<NewRequestButton locale="nb-NO" />);
    await userEvent.click(screen.getByRole("button", { name: "Ny forespørsel" }));

    expect(pushMock).toHaveBeenCalledWith("/nb-NO/journalist/requests/req-1");
  });

  it("viser en oversatt feilmelding når hastighetsgrensen er nådd, i stedet for å feile stille", async () => {
    // FR-020 (SPEC-V1.md 18): 20 utkast per journalist per døgn — et reelt
    // nåbart tilfelle, ikke bare en teoretisk feilvei.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: "errors.rate_limited" }) })
    );

    render(<NewRequestButton locale="nb-NO" />);
    await userEvent.click(screen.getByRole("button", { name: "Ny forespørsel" }));

    expect(
      await screen.findByText("Du har gjort dette for mange ganger på kort tid. Prøv igjen senere.")
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("viser en generisk feilmelding ved en nettverksfeil", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("nettverksfeil")));

    render(<NewRequestButton locale="nb-NO" />);
    await userEvent.click(screen.getByRole("button", { name: "Ny forespørsel" }));

    expect(await screen.findByText("Noe gikk galt. Prøv igjen.")).toBeInTheDocument();
  });
});
