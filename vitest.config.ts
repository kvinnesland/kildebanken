import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // Integrasjonstester (krever ekte Postgres) kjøres via en egen
    // konfigurasjon (`npm run test:integration`), ikke her — se
    // vitest.integration.config.ts.
    exclude: ["node_modules/**", "**/*.integration.test.ts"],
  },
});
