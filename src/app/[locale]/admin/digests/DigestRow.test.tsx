// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DigestRow } from "./DigestRow";

const digestWithFailures = {
  id: "digest-1",
  rowLabel: "1. august 2026 (sendt)",
  sentCount: 3,
  bouncedCount: 1,
  complainedCount: 0,
  failedCount: 2,
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("DigestRow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("viser sendt-, bounce-, klage- og feilet-tallene", () => {
    render(<DigestRow locale="nb-NO" digest={digestWithFailures} />);

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("deaktiverer 'kjør på nytt' når det ikke finnes noen mislykkede leveranser", () => {
    render(
      <DigestRow
        locale="nb-NO"
        digest={{ ...digestWithFailures, failedCount: 0 }}
      />
    );

    expect(screen.getByRole("button", { name: "Kjør på nytt" })).toBeDisabled();
  });

  it("viser en oversatt feilmelding når gjensending feiler, i stedet for å feile stille", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "errors.not_authorized" }),
      })
    );

    render(<DigestRow locale="nb-NO" digest={digestWithFailures} />);
    await userEvent.click(screen.getByRole("button", { name: "Kjør på nytt" }));

    expect(await screen.findByText("Du har ikke tilgang til å gjøre dette.")).toBeInTheDocument();
  });

  it("viser en suksessmelding med antall gjensendte etter et vellykket forsøk", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true, retried: 2 }) })
    );

    render(<DigestRow locale="nb-NO" digest={digestWithFailures} />);
    await userEvent.click(screen.getByRole("button", { name: "Kjør på nytt" }));

    expect(await screen.findByText("Gjensendt til 2 mottakere.")).toBeInTheDocument();
  });
});
