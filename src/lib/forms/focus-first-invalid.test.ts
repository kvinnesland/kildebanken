// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { focusFirstInvalidField } from "./focus-first-invalid";

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

describe("focusFirstInvalidField", () => {
  it("flytter fokus til det første elementet med aria-invalid=true", async () => {
    document.body.innerHTML = `
      <form>
        <input id="valid" aria-invalid="false" />
        <input id="first-invalid" aria-invalid="true" />
        <input id="second-invalid" aria-invalid="true" />
      </form>
    `;
    const form = document.querySelector("form") as HTMLFormElement;
    const ref = createRef<HTMLFormElement>();
    (ref as { current: HTMLFormElement }).current = form;

    focusFirstInvalidField(ref);
    await nextFrame();

    expect(document.activeElement?.id).toBe("first-invalid");
  });

  it("gjør ingenting når ingen felt er ugyldige", async () => {
    document.body.innerHTML = `<form><input id="valid" /></form>`;
    const form = document.querySelector("form") as HTMLFormElement;
    const ref = createRef<HTMLFormElement>();
    (ref as { current: HTMLFormElement }).current = form;

    focusFirstInvalidField(ref);
    await nextFrame();

    expect(document.activeElement).not.toBe(document.getElementById("valid"));
  });

  it("gjør ingenting når formRef.current er null", async () => {
    const ref = createRef<HTMLFormElement>();
    const focusSpy = vi.spyOn(HTMLElement.prototype, "focus");

    focusFirstInvalidField(ref);
    await nextFrame();

    expect(focusSpy).not.toHaveBeenCalled();
    focusSpy.mockRestore();
  });
});
