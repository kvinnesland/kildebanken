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
      // `server-only` (importert av src/lib/auth/session.ts m.fl.) løser seg
      // til den KASTENDE varianten (index.js) under Vitest, siden Vite ikke
      // setter "react-server"-eksportbetingelsen pakken sjekker mot — den
      // varianten er ment for RSC-bygg, ikke test. Peker eksplisitt til
      // pakkens egen `empty.js` (samme fil "react-server"-betingelsen ville
      // gitt), KUN for denne test-konfigurasjonen — rører ikke faktisk
      // byggekonfigurasjon (next.config.mjs), så garantien "server-only" gir
      // i PRODUKSJON er uendret. Uten dette kan INGEN modul som (transitivt)
      // importerer src/lib/auth/session.ts testes i det hele tatt, se
      // NATTLOGG.md.
      "server-only": path.resolve(__dirname, "./node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.integration.test.ts"],
    testTimeout: 15000,
    // Kjøres ÉN gang, i en egen prosess, etter at HELE pakken er ferdig —
    // fjerner alle @example.invalid-testbrukere ingen enkelt testfil selv
    // ryddet opp. Se filens egen kommentar for hvorfor (NATTLOGG.md, Økt 39).
    globalSetup: ["./src/db/integration/global-teardown.ts"],
  },
});
