import { defineConfig } from "vitest/config";
import path from "node:path";

// Egen konfigurasjon, adskilt fra vitest.config.ts med hensikt: disse
// testene krever en ekte Postgres (DATABASE_URL) og skal IKKE være en del
// av standard `npx vitest run` — den kjøres uten forutsetning om noen
// database tilgjengelig, og det skal den fortsette å gjøre. Se NATTLOGG.md
// økt 7 og README.md.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.integration.test.ts"],
    testTimeout: 15000,
  },
});
