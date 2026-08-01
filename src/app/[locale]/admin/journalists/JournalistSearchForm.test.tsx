// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JournalistSearchForm } from "./JournalistSearchForm";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("JournalistSearchForm", () => {
  it("navigerer til søket med ?email=, url-kodet, ved innsending", async () => {
    render(<JournalistSearchForm locale="nb-NO" initialQuery="" />);

    await userEvent.type(screen.getByLabelText("Søk på e-postadresse"), "test+en@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Søk" }));

    expect(pushMock).toHaveBeenCalledWith(
      "/nb-NO/admin/journalists?email=test%2Ben%40example.com"
    );
  });
});
