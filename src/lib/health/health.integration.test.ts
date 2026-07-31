import { describe, expect, it } from "vitest";
import { db, type Database } from "@/db/client";
import { checkHealth } from "./health";

describe("checkHealth mot ekte Postgres (INFRASTRUCTURE.md 8.1)", () => {
  it("rapporterer tilkoblet database og en faktisk migrasjonsversjon", async () => {
    const result = await checkHealth(db);

    expect(result.healthy).toBe(true);
    expect(result.database).toBe("connected");
    expect(result.migrationVersion).toEqual(expect.any(Number));
    expect(result.migrationVersion).toBeGreaterThan(0);
  });

  it("rapporterer usunn tilstand når databasetilkoblingen feiler, uten å kaste", async () => {
    const brokenDb = {
      execute: () => Promise.reject(new Error("connection refused")),
    } as unknown as Database;

    const result = await checkHealth(brokenDb);

    expect(result).toEqual({ healthy: false, database: "unreachable", migrationVersion: null });
  });
});
