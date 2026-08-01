// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import GlobalError from "./global-error";

// Ingen etablert mock-konvensjon for @sentry/nextjs fantes fra før i denne
// kodebasen (samme situasjon som next/navigation i
// LanguageSwitcher.test.tsx) — mock hele modulen, verifiser at feilen
// faktisk sendes videre til Sentry.
const captureExceptionMock = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (error: unknown) => captureExceptionMock(error),
}));

describe("GlobalError — Next.js sin reserveside for feil i selve root-laget", () => {
  it("rapporterer feilen til Sentry", () => {
    const error = Object.assign(new Error("root layout crashed"), { digest: "abc123" });
    render(<GlobalError error={error} />);

    expect(captureExceptionMock).toHaveBeenCalledWith(error);
  });

  it("setter lang på <html> (SPEC-V1.md 21.2 — dokumentnivå, aldri uten, selv uten en locale å slå opp)", () => {
    const error = Object.assign(new Error("root layout crashed"), { digest: "abc123" });
    render(<GlobalError error={error} />);

    // React setter attributter direkte på jsdom sitt EKTE
    // document.documentElement (bekreftet ved en manuell kikk på
    // outerHTML) fremfor å nøste et eget <html> under container-diven —
    // "In HTML, <html> cannot be a child of <div>"-advarselen testing-
    // library gir er derfor bare en JSX-strukturadvarsel, ikke et tegn på
    // at attributter havner feil sted.
    expect(document.documentElement).toHaveAttribute("lang", "en");
  });
});
