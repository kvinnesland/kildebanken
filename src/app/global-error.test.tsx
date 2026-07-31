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
});
