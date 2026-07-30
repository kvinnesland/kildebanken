// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge", () => {
  it.each([
    ["neutral", "Lukket"],
    ["success", "Åpen"],
    ["warning", "Fristen har gått ut"],
    ["danger", "Avvist"],
  ] as const)("viser teksten for tone %s (DESIGN.md 6.2: farge er aldri eneste bærer av mening)", (tone, text) => {
    render(<Badge tone={tone}>{text}</Badge>);
    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
