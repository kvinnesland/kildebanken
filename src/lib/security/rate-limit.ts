import { and, eq, lt, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { rateLimitHits } from "@/db/schema";

// SPEC-V1.md 18 / 19.16. Sliding-window-teller: sletter rader eldre enn
// EGET tidsvindu for denne bucketen først (selvrenskende, ingen egen
// opprydningsjobb trengs — se 19.16), teller det som er igjen, og avviser
// hvis grensen allerede er nådd UTEN å legge til en ny rad (en avvist
// forespørsel skal ikke i seg selv gjøre neste forespørsel innenfor samme
// vindu enda mer avvist enn den allerede er).
//
// Hele sjekken kjører i én transaksjon, låst med en per-bucket advisory-lås
// (`pg_advisory_xact_lock`, frigitt automatisk ved commit/rollback) — uten
// denne kunne to samtidige kall for SAMME bucket begge lese antallet FØR
// noen av dem satte inn sin egen rad (TOCTOU), og dermed begge slippe
// gjennom selv om det til sammen sprenger grensen. Reelt hull frem til nå
// (funnet under en kritisk gjennomlesing av allerede bygget kode, se
// NATTLOGG.md) — lav alvorlighet i praksis (Stadium 0 har ingen reell
// samtidig trafikk ennå), men en sikkerhetskontroll bør være korrekt
// uavhengig av dagens trafikkmengde. `hashtext()` gjør bucket-STRENGEN om
// til et 32-bits nøkkeltall Postgres kan låse på; en kollisjon mellom to
// ULIKE bucketer ville i verste fall gjøre dem midlertidig serielle mot
// hverandre også — ikke et korrekthetsproblem, bare en teoretisk, ufarlig
// ekstra ventetid.
export async function checkRateLimit(
  db: Database,
  bucket: string,
  windowMs: number,
  maxHits: number
): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${bucket}))`);

    const windowStart = new Date(Date.now() - windowMs);

    await tx
      .delete(rateLimitHits)
      .where(and(eq(rateLimitHits.bucket, bucket), lt(rateLimitHits.createdAt, windowStart)));

    const hits = await tx
      .select({ id: rateLimitHits.id })
      .from(rateLimitHits)
      .where(eq(rateLimitHits.bucket, bucket));

    if (hits.length >= maxHits) return false;

    await tx.insert(rateLimitHits).values({ bucket });
    return true;
  });
}
