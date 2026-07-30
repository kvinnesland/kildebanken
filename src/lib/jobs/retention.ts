// Retensjonsjobben (SPEC-V1.md 17.4). Bygget forsiktig, per brukerens
// eksplisitte instruks: standard er `dry run` — jobben SELECTer og teller
// hva den ville påvirket, men sletter/anonymiserer ingenting med mindre
// `RETENTION_DRY_RUN=false` er eksplisitt satt. Dette er bevisst, ikke en
// midlertidig glemsel: sletting av ekte personopplysninger feil vei er
// irreversibelt, og skal ikke kunne skje bare fordi denne filen ble deployet.
//
// TODO (viktig, se NATTLOGG.md økt 5): SPEC-V1.md 17.4 sier eksplisitt at
// lagringstider "settes som konfigurasjon per land, ikke som konstanter i
// forretningslogikken". Med kun ett aktivt land (NO, fortsatt `draft`) er
// det ingen reell variasjon å konfigurere ennå, så periodene under er
// hardkodede navngitte konstanter — en bevisst, midlertidig forenkling. MÅ
// bli ekte per-land-konfigurasjon (nye kolonner på `countries`) før et
// land nummer to med andre krav legges til.

import { and, eq, inArray, lt } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import {
  auditLogs,
  authTokens,
  consentRecords,
  contactRequests,
  digestDeliveries,
  digests,
  journalistProfiles,
  requests,
  responses,
  sessions,
  users,
} from "@/db/schema";

const RETENTION_PERIOD = {
  responseMonthsAfterClose: 12,
  contactRequestMonthsAfterResolution: 12,
  rejectedJournalistMonths: 6,
  digestMonths: 12,
} as const;
const AUDIT_LOG_RETENTION_YEARS = 3;

export function isRetentionDryRun(): boolean {
  // Standard TRUE (sikker). Må eksplisitt settes til "false" for å faktisk
  // slette noe — se filkommentaren over.
  return process.env.RETENTION_DRY_RUN !== "false";
}

export function monthsAgo(n: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d;
}

export function yearsAgo(n: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCFullYear(d.getUTCFullYear() - n);
  return d;
}

export interface RetentionCategoryResult {
  category: string;
  dryRun: boolean;
  affectedCount: number;
  errors: string[];
}

export interface RetentionSummary {
  ranAt: string;
  dryRun: boolean;
  results: RetentionCategoryResult[];
}

/**
 * Kjøres daglig (se INFRASTRUCTURE.md 5.1). Én kategori om gangen, hver med
 * sin egen try/catch — én kategoris feil skal ikke stoppe de andre, samme
 * prinsipp som FR-036 for digest-utsendelse.
 */
export async function runRetention(dbase: Database = db): Promise<RetentionSummary> {
  const dryRun = isRetentionDryRun();
  const results: RetentionCategoryResult[] = [];

  results.push(await purgeOldResponses(dbase, dryRun));
  results.push(await purgeOldContactRequests(dbase, dryRun));
  results.push(await purgeRejectedJournalistApplications(dbase, dryRun));
  results.push(await purgeOldAuditLogs(dbase, dryRun));
  results.push(await purgeOldDigests(dbase, dryRun));

  return { ranAt: new Date().toISOString(), dryRun, results };
}

/**
 * SPEC-V1.md 17.4/17.5: "svarteksten beholdes til den ordinære
 * retensjonsfristen løper ut" — tolket som at selve svarraden slettes når
 * fristen faktisk løper ut (12 måneder etter at forespørselen ble lukket),
 * ikke at den anonymiseres i påvente av en senere jobb. Trukne svar er IKKE
 * denne jobbens ansvar — de skal slettes umiddelbart ved trekking, i selve
 * withdraw-endepunktet (ikke bygget ennå), ikke via en periodisk sveip.
 */
async function purgeOldResponses(
  dbase: Database,
  dryRun: boolean
): Promise<RetentionCategoryResult> {
  const errors: string[] = [];
  const cutoff = monthsAgo(RETENTION_PERIOD.responseMonthsAfterClose);

  try {
    const candidates = await dbase
      .select({ id: responses.id })
      .from(responses)
      .innerJoin(requests, eq(responses.requestId, requests.id))
      .where(and(eq(responses.lifecycleStatus, "submitted"), lt(requests.closedAt, cutoff)));

    if (!dryRun && candidates.length > 0) {
      const ids = candidates.map((c) => c.id);
      await dbase.delete(responses).where(inArray(responses.id, ids));
    }

    return { category: "responses", dryRun, affectedCount: candidates.length, errors };
  } catch (err) {
    errors.push((err as Error).message);
    return { category: "responses", dryRun, affectedCount: 0, errors };
  }
}

/**
 * "12 måneder etter avslutning". `ContactRequest` har ikke et eget
 * `resolved_at`-felt (se SPEC-V1.md 19.8) — `updated_at` brukes som
 * tilnærming, siden raden alltid oppdateres idet den forlater `pending`.
 * Kun rader i en terminal status regnes, aldri `pending`.
 */
async function purgeOldContactRequests(
  dbase: Database,
  dryRun: boolean
): Promise<RetentionCategoryResult> {
  const errors: string[] = [];
  const cutoff = monthsAgo(RETENTION_PERIOD.contactRequestMonthsAfterResolution);

  try {
    const candidates = await dbase
      .select({ id: contactRequests.id })
      .from(contactRequests)
      .where(
        and(
          inArray(contactRequests.status, ["approved", "declined", "expired", "cancelled"]),
          lt(contactRequests.updatedAt, cutoff)
        )
      );

    if (!dryRun && candidates.length > 0) {
      const ids = candidates.map((c) => c.id);
      await dbase.delete(contactRequests).where(inArray(contactRequests.id, ids));
    }

    return { category: "contact_requests", dryRun, affectedCount: candidates.length, errors };
  } catch (err) {
    errors.push((err as Error).message);
    return { category: "contact_requests", dryRun, affectedCount: 0, errors };
  }
}

/**
 * "Avvist journalistsøknad: 6 måneder." Bygget ferdig under autonomt arbeid
 * (økt 7, se NATTLOGG.md) — kun TELT frem til nå, aldri utført, fordi
 * sletting av `User`-raden krysser flere tabeller.
 *
 * `verification_status = rejected` er ENDELIG (8.1), og BÅDE
 * `pending_review` og `rejected` har "kan sende til moderering: nei" — en
 * avvist journalist kan derfor ALDRI ha fått en forespørsel til
 * `submitted`/`published`. Enhver forespørsel journalisten måtte ha laget
 * er dermed GARANTERT `draft | changes_requested | rejected`, og kan aldri
 * ha noe svar eller kontaktforespørsel knyttet til seg (begge krever en
 * `published` forespørsel å eksistere mot). Full sletting av kontoen er
 * derfor trygt uten noen egen anonymiseringslogikk.
 *
 * Bevisst IKKE via samme rutine som 17.5 (`performAccountDeletion()` i
 * `account-deletion.ts`) — den er for en AKTIV/godkjent konto og sender en
 * bekreftelses-e-post til brukeren. En avvist, aldri-godkjent søknad har
 * ingen aktivitet å varsle om, og renskes STILLE — samme prinsipp som de
 * fire andre kategoriene i denne jobben, ingen av dem varsler noen.
 */
async function purgeRejectedJournalistApplications(
  dbase: Database,
  dryRun: boolean
): Promise<RetentionCategoryResult> {
  const errors: string[] = [];
  const cutoff = monthsAgo(RETENTION_PERIOD.rejectedJournalistMonths);

  try {
    const candidates = await dbase
      .select({ id: journalistProfiles.id, userId: journalistProfiles.userId })
      .from(journalistProfiles)
      .where(
        and(
          eq(journalistProfiles.verificationStatus, "rejected"),
          lt(journalistProfiles.reviewedAt, cutoff)
        )
      );

    if (!dryRun) {
      for (const candidate of candidates) {
        // Rekkefølge: alt som refererer til user_id/journalist_id FØR selve
        // User-raden, ellers feiler FK-constraint-en.
        await dbase.delete(requests).where(eq(requests.journalistId, candidate.userId));
        await dbase.delete(consentRecords).where(eq(consentRecords.userId, candidate.userId));
        await dbase.delete(authTokens).where(eq(authTokens.userId, candidate.userId));
        await dbase.delete(sessions).where(eq(sessions.userId, candidate.userId));
        await dbase.delete(journalistProfiles).where(eq(journalistProfiles.id, candidate.id));
        await dbase.delete(users).where(eq(users.id, candidate.userId));
      }
    }

    return {
      category: "rejected_journalist_applications",
      dryRun,
      affectedCount: candidates.length,
      errors,
    };
  } catch (err) {
    errors.push((err as Error).message);
    return { category: "rejected_journalist_applications", dryRun, affectedCount: 0, errors };
  }
}

/** "Revisjonslogg: 3 år." */
async function purgeOldAuditLogs(
  dbase: Database,
  dryRun: boolean
): Promise<RetentionCategoryResult> {
  const errors: string[] = [];
  const cutoff = yearsAgo(AUDIT_LOG_RETENTION_YEARS);

  try {
    const candidates = await dbase
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(lt(auditLogs.createdAt, cutoff));

    if (!dryRun && candidates.length > 0) {
      const ids = candidates.map((c) => c.id);
      await dbase.delete(auditLogs).where(inArray(auditLogs.id, ids));
    }

    return { category: "audit_logs", dryRun, affectedCount: candidates.length, errors };
  } catch (err) {
    errors.push((err as Error).message);
    return { category: "audit_logs", dryRun, affectedCount: 0, errors };
  }
}

/** "Digest og leveringsstatus: 12 måneder." Sletter DigestDelivery først
 * (FK mot Digest), deretter selve Digest-raden. */
async function purgeOldDigests(dbase: Database, dryRun: boolean): Promise<RetentionCategoryResult> {
  const errors: string[] = [];
  const cutoff = monthsAgo(RETENTION_PERIOD.digestMonths);

  try {
    const candidates = await dbase
      .select({ id: digests.id })
      .from(digests)
      .where(lt(digests.createdAt, cutoff));

    if (!dryRun && candidates.length > 0) {
      const ids = candidates.map((c) => c.id);
      await dbase.delete(digestDeliveries).where(inArray(digestDeliveries.digestId, ids));
      await dbase.delete(digests).where(inArray(digests.id, ids));
    }

    return { category: "digests", dryRun, affectedCount: candidates.length, errors };
  } catch (err) {
    errors.push((err as Error).message);
    return { category: "digests", dryRun, affectedCount: 0, errors };
  }
}
