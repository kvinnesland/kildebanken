// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogoutButton } from "./LogoutButton";

// Første komponent i kodebasen som bruker next/navigation sin
// useRouter() — samme mock-mønster som LanguageSwitcher.test.tsx satte for
// usePathname(): mock hele modulen, verifiser at komponenten faktisk
// kaller de riktige metodene på den.
const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

describe("LogoutButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    pushMock.mockClear();
    refreshMock.mockClear();
  });

  it("logger ut, sender til innloggingssiden for gjeldende locale, og oppdaterer serverdataene", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<LogoutButton locale="nb-NO" />);
    await userEvent.click(screen.getByRole("button", { name: "Logg ut" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
    expect(pushMock).toHaveBeenCalledWith("/nb-NO/logg-inn");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("bruker RIKTIG locale-segment i omdirigeringen, ikke alltid nb-NO", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    render(<LogoutButton locale="en-GB" />);
    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(pushMock).toHaveBeenCalledWith("/en-GB/logg-inn");
  });
});
