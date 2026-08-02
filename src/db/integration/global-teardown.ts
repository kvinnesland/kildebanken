// Globalt opprydningssteg for integrasjonstestpakken (se `globalSetup` i
// vitest.integration.config.ts) — kjøres ÉN gang, i en EGEN prosess, etter at
// HELE pakken er ferdig (ikke per fil eller per describe-blokk). Fjerner ALLE
// testbrukere (`@example.invalid`, RFC 2606-reservert domene som ALDRI kan
// kollidere med en ekte adresse) og alt som refererer til dem.
//
// Bakgrunn (se NATTLOGG.md, Økt 37-39): gjentatte per-fil opprydningshull i
// `createModerator()`/`createAdmin()`-hjelpere viste at det å stole på at
// HVER testfil selv rydder opp er skjørt — en ny fil (eller en ny test i en
// gammel fil) kan alltid glemme det samme igjen. Samme mønster viste seg langt
// større for mottakere/journalister (~232 nye rader PER fulle kjøring av hele
// pakken, 15258 opphopede rader totalt før denne fiksen) — altfor mange
// kallesteder til at én-og-én-fil-fiksing (slik moderator/admin-fiksene
// gjorde) er en praktisk løsning. Dette er den systemiske løsningen i stedet:
// uansett hva en enkelt testfil glemmer å rydde opp selv, fjernes det likevel
// her, én gang, rett etter at pakken er ferdig.
//
// Rører ALDRI rader UTENFOR `@example.invalid`-domenet. Kontosletting
// (`performAccountDeletion()`, SPEC-V1.md 17.5) ANONYMISERER bevisst i stedet
// for å slette selve raden (e-posten erstattes med en hash) — disse
// testresultatene er et spec-KORREKT sluttresultat, ikke et opprydningshull,
// og skal bli stående akkurat som de ville gjort i produksjon.

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { inArray, like } from "drizzle-orm";
import {
  auditLogs,
  authTokens,
  consentRecords,
  contactRequests,
  digestDeliveries,
  emailSubscriptions,
  journalistProfiles,
  moderatorCountries,
  requests,
  responses,
  sessions,
  users,
} from "@/db/schema";

// Store nok til å holde antall runde-turer lavt, liten nok til å unngå
// unødvendig store enkeltspørringer — samme størrelse som de tidligere
// engangs-opprydningsskriptene for moderator/admin-hullene brukte.
const CHUNK_SIZE = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function teardown(): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  // Egen, frittstående tilkobling — denne funksjonen kjører i en helt annen
  // prosess enn selve testfilene (Vitest sin `globalSetup`-kontrakt), så den
  // kan ikke gjenbruke `@/db/client` sin poolinstans. Lukkes eksplisitt i
  // `finally` for å ikke la testkjøringen henge på en åpen tilkobling.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(like(users.email, "%@example.invalid"));
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return;

    console.log(`[global-teardown] Rydder opp ${ids.length} testbrukere (@example.invalid).`);

    for (const idChunk of chunk(ids, CHUNK_SIZE)) {
      // journalistProfiles.reviewedBy peker på en administrator/moderator —
      // også DE er testbrukere i dette utvalget, siden ALLE testbrukere deler
      // samme domene. Må nulles FØR selve brukerraden slettes (ingen kaskade,
      // bevisst, se schema.ts).
      await db
        .update(journalistProfiles)
        .set({ reviewedBy: null })
        .where(inArray(journalistProfiles.reviewedBy, idChunk));

      // Finn ALLE forespørsler denne gruppen "eier" — enten som journalist
      // ELLER som den som modererte den — FØR noe slettes, slik at svar
      // knyttet til DISSE forespørslene (uansett hvem som svarte) også
      // fanges opp, ikke bare svar der respondentId selv er i utvalget.
      const requestsByJournalist = await db
        .select({ id: requests.id })
        .from(requests)
        .where(inArray(requests.journalistId, idChunk));
      const requestsByModerator = await db
        .select({ id: requests.id })
        .from(requests)
        .where(inArray(requests.moderatedBy, idChunk));
      const requestIds = [
        ...new Set([...requestsByJournalist.map((r) => r.id), ...requestsByModerator.map((r) => r.id)]),
      ];

      const respondentResponses = await db
        .select({ id: responses.id })
        .from(responses)
        .where(inArray(responses.respondentId, idChunk));
      const requestResponses =
        requestIds.length > 0
          ? await db.select({ id: responses.id }).from(responses).where(inArray(responses.requestId, requestIds))
          : [];
      const responseIds = [
        ...new Set([...respondentResponses.map((r) => r.id), ...requestResponses.map((r) => r.id)]),
      ];

      // contact_requests.response_id FØRST — samme frikobling
      // withdrawResponse()/retention.ts sin purgeOldResponses() allerede gjør
      // ved sletting av et enkelt svar, generalisert til hele utvalget her.
      if (responseIds.length > 0) {
        await db.delete(contactRequests).where(inArray(contactRequests.responseId, responseIds));
      }
      await db.delete(contactRequests).where(inArray(contactRequests.journalistId, idChunk));

      if (responseIds.length > 0) {
        await db.delete(responses).where(inArray(responses.id, responseIds));
      }
      if (requestIds.length > 0) {
        await db.delete(requests).where(inArray(requests.id, requestIds));
      }

      await db.delete(digestDeliveries).where(inArray(digestDeliveries.userId, idChunk));
      await db.delete(consentRecords).where(inArray(consentRecords.userId, idChunk));
      await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, idChunk));
      await db.delete(authTokens).where(inArray(authTokens.userId, idChunk));
      await db.delete(sessions).where(inArray(sessions.userId, idChunk));
      await db.delete(emailSubscriptions).where(inArray(emailSubscriptions.userId, idChunk));
      await db.delete(journalistProfiles).where(inArray(journalistProfiles.userId, idChunk));
      await db.delete(moderatorCountries).where(inArray(moderatorCountries.moderatorUserId, idChunk));
      await db.delete(users).where(inArray(users.id, idChunk));
    }

    console.log(`[global-teardown] Ferdig — ${ids.length} testbrukere fjernet.`);
  } finally {
    await pool.end();
  }
}
