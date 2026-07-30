// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("rendrer barn-teksten og reagerer på klikk", async () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Send</Button>);

    const button = screen.getByRole("button", { name: "Send" });
    await userEvent.click(button);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("er fokuserbar med tastatur og trigges med Enter (DESIGN.md 6: arvet tastaturhåndtering)", async () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Send</Button>);

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Send" })).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("er ikke trykkbar når isDisabled er satt", async () => {
    const onPress = vi.fn();
    render(
      <Button onPress={onPress} isDisabled>
        Send
      </Button>
    );

    const button = screen.getByRole("button", { name: "Send" });
    expect(button).toBeDisabled();

    await userEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
