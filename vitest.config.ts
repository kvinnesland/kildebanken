import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  // Kun for JSX-transform i komponenttester (Button.test.tsx m.fl.) — selve
  // Next.js-appen bruker fortsatt Next sin egen SWC-kompilator (next.config.mjs),
  // ikke denne. Uten denne feiler enhver .tsx-test med "React is not defined",
  // siden vitest ellers ikke vet at JSX skal transformeres til React.createElement.
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // Integrasjonstester (krever ekte Postgres) kjøres via en egen
    // konfigurasjon (`npm run test:integration`), ikke her — se
    // vitest.integration.config.ts. Komponenttester (.tsx, se
    // src/components/) overstyrer miljøet til jsdom per fil via
    // `// @vitest-environment jsdom`-kommentaren øverst i filen — resten av
    // suiten (bibliotekskode) fortsetter å kjøre i node, uten forutsetning
    // om en DOM.
    exclude: ["node_modules/**", "**/*.integration.test.ts"],
    // Registrerer testing-library sin DOM-opprydding mellom hver test og
    // jest-dom sine matchers (toBeInTheDocument m.fl.) — et no-op i
    // node-miljø, så resten av suiten påvirkes ikke.
    setupFiles: ["./src/test/setup-dom.ts"],
  },
});
