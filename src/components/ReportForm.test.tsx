// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportForm } from "./ReportForm";

describe("ReportForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("viser rapporter-knappen sammenslått, ikke skjemaet, i utgangspunktet", () => {
    render(<ReportForm locale="nb-NO" entityType="request" entityId="req-1" />);
    expect(screen.getByRole("button", { name: "Rapporter denne forespørselen" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Hvorfor rapporterer du dette?")).not.toBeInTheDocument();
  });

  it("åpner skjemaet ved klikk, og krever en begrunnelse før innsending", async () => {
    render(<ReportForm locale="nb-NO" entityType="request" entityId="req-1" />);
    await userEvent.click(screen.getByRole("button", { name: "Rapporter denne forespørselen" }));

    const submit = screen.getByRole("button", { name: "Send rapport" });
    await userEvent.click(submit);

    expect(screen.getByText("Du må oppgi en begrunnelse.")).toBeInTheDocument();
  });

  it("sender rapporten og viser en takkemelding", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<ReportForm locale="nb-NO" entityType="request" entityId="req-1" />);
    await userEvent.click(screen.getByRole("button", { name: "Rapporter denne forespørselen" }));
    await userEvent.type(screen.getByLabelText("Hvorfor rapporterer du dette?"), "Dette er villedende.");
    await userEvent.click(screen.getByRole("button", { name: "Send rapport" }));

    expect(await screen.findByText("Takk. Moderator for dette landet er varslet.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/report",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          entityType: "request",
          entityId: "req-1",
          reason: "Dette er villedende.",
          comment: undefined,
        }),
      })
    );
  });

  it("lar brukeren avbryte og lukke skjemaet igjen", async () => {
    render(<ReportForm locale="nb-NO" entityType="request" entityId="req-1" />);
    await userEvent.click(screen.getByRole("button", { name: "Rapporter denne forespørselen" }));
    await userEvent.click(screen.getByRole("button", { name: "Avbryt" }));
    expect(screen.getByRole("button", { name: "Rapporter denne forespørselen" })).toBeInTheDocument();
  });

  it("bruker riktig knappetekst for entityType='response' — ikke den samme teksten som for en forespørsel", () => {
    render(<ReportForm locale="nb-NO" entityType="response" entityId="resp-1" />);
    expect(screen.getByRole("button", { name: "Rapporter dette svaret" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rapporter denne forespørselen" })).not.toBeInTheDocument();
  });
});
