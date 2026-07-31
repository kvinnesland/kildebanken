import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { checkHealth } from "@/lib/health/health";

// GET /health (INFRASTRUCTURE.md 8.1). Brukt av deploy-laget (rullende
// omstart venter på en frisk instans) og oppetidsovervåkingen (10: "2
// påfølgende feil" → varsel). Ingen i18n her — dette er et maskin-
// endepunkt for driftsverktøy, ikke en side en bruker ser (samme unntak
// som src/app/global-error.tsx).
export async function GET() {
  const result = await checkHealth(db);

  return NextResponse.json(
    {
      status: result.healthy ? "ok" : "error",
      database: result.database,
      migrationVersion: result.migrationVersion,
    },
    { status: result.healthy ? 200 : 503 }
  );
}
