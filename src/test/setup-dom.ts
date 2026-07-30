// Kjøres FØR hver testfil i standardsuiten (se vitest.config.ts,
// `test.setupFiles`). Kun relevant for komponenttester (jsdom-miljø via
// `// @vitest-environment jsdom`) — resten av suiten (bibliotekskode, node-
// miljø) berøres ikke av dette, `cleanup()` er et no-op uten en DOM.
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

afterEach(() => {
  cleanup();
});
