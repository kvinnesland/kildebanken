// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileForm } from "./ProfileForm";

function renderForm() {
  return render(
    <ProfileForm
      locale="nb-NO"
      availableLocales={["nb-NO", "en-GB"]}
      initial={{ displayName: "Kari", locale: "nb-NO", timezone: "Europe/Oslo" }}
    />
  );
}

describe("ProfileForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("begrenser visningsnavn til 80 tegn i selve inputfeltet, samme grense som PATCH /me håndhever server-side", () => {
    // Sto tidligere som 200 her, en reell uoverensstemmelse med serverens
    // grense (rettet forrige runde, se NATTLOGG.md) — denne testen ville
    // fanget akkurat den regresjonen.
    renderForm();
    const input = screen.getByLabelText("Visningsnavn");
    expect(input).toHaveAttribute("maxLength", "80");
  });

  it("lagrer endringer og viser en bekreftelse", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    renderForm();
    await userEvent.clear(screen.getByLabelText("Visningsnavn"));
    await userEvent.type(screen.getByLabelText("Visningsnavn"), "Nytt Navn");
    await userEvent.click(screen.getByRole("button", { name: "Lagre" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/me",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ displayName: "Nytt Navn", locale: "nb-NO", timezone: "Europe/Oslo" }),
      })
    );
    expect(await screen.findByText("Lagret.")).toBeInTheDocument();
  });
});
