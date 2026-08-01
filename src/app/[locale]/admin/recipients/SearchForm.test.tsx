// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchForm } from "./SearchForm";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("SearchForm", () => {
  it("navigerer til søket med ?email=, url-kodet, ved innsending", async () => {
    render(<SearchForm locale="nb-NO" initialQuery="" />);

    await userEvent.type(screen.getByLabelText("Søk på e-postadresse"), "test+en@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Søk" }));

    expect(pushMock).toHaveBeenCalledWith(
      "/nb-NO/admin/recipients?email=test%2Ben%40example.com"
    );
  });
});
