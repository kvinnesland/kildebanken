// Tynn adapter — se INFRASTRUCTURE.md 16.3 og 16.8. Denne filen skal ALDRI
// inneholde forretningslogikk. Alt den gjør er å importere den vert-uvitende
// funksjonen og kalle den. Ved bytte til Hetzner erstattes denne filen med en
// pg-boss-lytteprosess eller en cron-linje som kaller nøyaktig samme
// `runTick()` — src/lib/jobs/tick.ts røres ikke.
//
// Utløses hvert 15. minutt via `schedule` i netlify.toml.

import type { Config } from "@netlify/functions";
import { runTick } from "../../src/lib/jobs/tick";

async function handler() {
  const summary = await runTick();

  const failedJobs = summary.results.filter((r) => r.errors.length > 0);
  if (failedJobs.length > 0) {
    console.error("[tick] jobber med feil:", JSON.stringify(failedJobs));
  }
  console.log("[tick] fullført:", JSON.stringify(summary));

  return new Response(JSON.stringify(summary), {
    headers: { "content-type": "application/json" },
  });
}

export default handler;

export const config: Config = {
  schedule: "*/15 * * * *",
};
