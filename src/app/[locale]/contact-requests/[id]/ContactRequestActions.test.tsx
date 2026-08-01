// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactRequestActions } from "./ContactRequestActions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("ContactRequestActions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("godkjenner og viser en bekreftelse ved suksess", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    render(<ContactRequestActions locale="nb-NO" contactRequestId="cr-1" />);
    await userEvent.click(screen.getByRole("button", { name: "Godkjenn og del e-postadressen min" }));

    expect(
      await screen.findByText(
        "Du har godkjent kontaktforespørselen. E-postadressen din er delt med journalisten."
      )
    ).toBeInTheDocument();
  });

  it("viser en oversatt feilmelding når godkjenning feiler, i stedet for å feile stille", async () => {
    // Nåbart i praksis: respondToContactRequest() sjekker expiresAt direkte
    // (se contact-requests.ts) — en forespørsel siden viste som pending kan
    // ha rukket å utløpe før respondenten trykket.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "errors.contact_request_not_pending" }),
      })
    );

    render(<ContactRequestActions locale="nb-NO" contactRequestId="cr-1" />);
    await userEvent.click(screen.getByRole("button", { name: "Godkjenn og del e-postadressen min" }));

    expect(
      await screen.findByText("Denne kontaktforespørselen er ikke lenger ventende.")
    ).toBeInTheDocument();
  });

  it("viser en oversatt feilmelding når avslag feiler", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "errors.contact_request_not_pending" }),
      })
    );

    render(<ContactRequestActions locale="nb-NO" contactRequestId="cr-1" />);
    await userEvent.click(screen.getByRole("button", { name: "Avslå" }));

    expect(
      await screen.findByText("Denne kontaktforespørselen er ikke lenger ventende.")
    ).toBeInTheDocument();
  });
});
