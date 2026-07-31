import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { rateLimitHits } from "@/db/schema";
import { checkRateLimit } from "./rate-limit";

function countHits(bucket: string): Promise<number> {
  return db
    .select()
    .from(rateLimitHits)
    .where(eq(rateLimitHits.bucket, bucket))
    .then((rows) => rows.length);
}

describe("checkRateLimit mot ekte Postgres (SPEC-V1.md 18 / 19.16)", () => {
  it("tillater de første N forespørslene og registrerer en rad per godkjent kall", async () => {
    const bucket = `test:${randomUUID()}`;

    for (let i = 0; i < 3; i++) {
      expect(await checkRateLimit(db, bucket, 60_000, 3)).toBe(true);
    }

    expect(await countHits(bucket)).toBe(3);
  });

  it("avviser forespørsel nummer N+1 innenfor vinduet, uten å legge til en ny rad", async () => {
    const bucket = `test:${randomUUID()}`;

    for (let i = 0; i < 3; i++) {
      await checkRateLimit(db, bucket, 60_000, 3);
    }
    const allowed = await checkRateLimit(db, bucket, 60_000, 3);

    expect(allowed).toBe(false);
    expect(await countHits(bucket)).toBe(3);
  });

  it("teller ulike bucketer helt uavhengig av hverandre", async () => {
    const bucketA = `test:${randomUUID()}`;
    const bucketB = `test:${randomUUID()}`;

    for (let i = 0; i < 2; i++) {
      await checkRateLimit(db, bucketA, 60_000, 2);
    }

    expect(await checkRateLimit(db, bucketB, 60_000, 2)).toBe(true);
  });

  it("sletter rader eldre enn vinduet før telling, slik at en gammel rad ikke teller mot grensen", async () => {
    const bucket = `test:${randomUUID()}`;
    await db.insert(rateLimitHits).values({
      bucket,
      createdAt: new Date(Date.now() - 2 * 60_000), // 2 min gammel
    });

    // Vindu på 1 minutt — den 2 minutter gamle raden skal IKKE telle med,
    // så et nytt kall med maks 1 skal fortsatt slippe gjennom.
    const allowed = await checkRateLimit(db, bucket, 60_000, 1);

    expect(allowed).toBe(true);
    expect(await countHits(bucket)).toBe(1); // den gamle raden er slettet, kun den nye er igjen
  });
});
