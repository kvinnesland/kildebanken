import { sql } from "drizzle-orm";
import type { Database } from "@/db/client";

// INFRASTRUCTURE.md 8.1. Se src/app/api/health/route.ts for hvorfor
// køtilkobling ikke er med (Stadium 0 har ingen faktisk jobbkø ennå).
export interface HealthCheckResult {
  healthy: boolean;
  database: "connected" | "unreachable";
  migrationVersion: number | null;
}

export async function checkHealth(db: Database): Promise<HealthCheckResult> {
  try {
    const result = await db.execute<{ id: number }>(
      sql`select id from drizzle.__drizzle_migrations order by id desc limit 1`
    );
    return {
      healthy: true,
      database: "connected",
      migrationVersion: result.rows[0]?.id ?? null,
    };
  } catch {
    return { healthy: false, database: "unreachable", migrationVersion: null };
  }
}
