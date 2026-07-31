import { and, eq, lt } from "drizzle-orm";
import type { Database } from "@/db/client";
import { rateLimitHits } from "@/db/schema";

// SPEC-V1.md 18 / 19.16. Sliding-window-teller: sletter rader eldre enn
// EGET tidsvindu for denne bucketen først (selvrenskende, ingen egen
// opprydningsjobb trengs — se 19.16), teller det som er igjen, og avviser
// hvis grensen allerede er nådd UTEN å legge til en ny rad (en avvist
// forespørsel skal ikke i seg selv gjøre neste forespørsel innenfor samme
// vindu enda mer avvist enn den allerede er).
export async function checkRateLimit(
  db: Database,
  bucket: string,
  windowMs: number,
  maxHits: number
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs);

  await db
    .delete(rateLimitHits)
    .where(and(eq(rateLimitHits.bucket, bucket), lt(rateLimitHits.createdAt, windowStart)));

  const hits = await db
    .select({ id: rateLimitHits.id })
    .from(rateLimitHits)
    .where(eq(rateLimitHits.bucket, bucket));

  if (hits.length >= maxHits) return false;

  await db.insert(rateLimitHits).values({ bucket });
  return true;
}
