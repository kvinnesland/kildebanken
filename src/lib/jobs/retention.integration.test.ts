import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLogs,
  contactRequests,
  digestDeliveries,
  digests,
  journalistProfiles,
  requests,
  responses,
  users,
} from "@/db/schema";
import {
  createActiveJournalist,
  createActiveRecipient,
  ensureTestCountry,
  TEST_COUNTRY_CODE,
} from "@/db/integration/fixtures";
import { runRetention } from "./retention";

// SPEC-V1.md 17.4 — retensjonsjobben SLETTER/ANONYMISERER ekte
// personopplysninger. Brukerens eksplisitte instruks fra natten: bygg dette
// FORSIKTIG med egne tester FØR det kobles til noe som ligner ekte data.
// Disse testene manglet fortsatt frem til nå — kun de rene dato-/
// flagg-funksjonene var testet (retention.test.ts), aldri de fem faktiske
// SQL-kategoriene mot en ekte database. Kjøres KUN mot den disponible
// sandkasse-databasen (kildebanken_test), aldri mot noe som ligner
// produksjon.

const ORIGINAL_DRY_RUN = process.env.RETENTION_DRY_RUN;

function setDryRun(value: "true" | "false"): void {
  process.env.RETENTION_DRY_RUN = value;
}

describe("runRetention mot ekte Postgres (17.4)", () => {
  beforeAll(async () => {
    await ensureTestCountry();
  });

  afterEach(() => {
    if (ORIGINAL_DRY_RUN === undefined) delete process.env.RETENTION_DRY_RUN;
    else process.env.RETENTION_DRY_RUN = ORIGINAL_DRY_RUN;
  });

  describe("innsendte svar — 12 måneder etter at forespørselen lukkes", () => {
    let journalistId: string;
    let oldRequestId: string;
    let oldResponseId: string;
    let recentRequestId: string;
    let recentResponseId: string;

    beforeAll(async () => {
      const journalist = await createActiveJournalist();
      journalistId = journalist.id;

      const now = new Date();
      const thirteenMonthsAgo = new Date(now);
      thirteenMonthsAgo.setUTCMonth(thirteenMonthsAgo.getUTCMonth() - 13);
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setUTCMonth(oneMonthAgo.getUTCMonth() - 1);

      async function makeClosedRequestWithResponse(closedAt: Date) {
        const [request] = await db
          .insert(requests)
          .values({
            journalistId,
            countryCode: TEST_COUNTRY_CODE,
            contentLanguage: "nb-NO",
            title: "Retensjonstest",
            summary: "En testforespørsel for retensjon.",
            description: "Full beskrivelse.",
            targetPersonDescription: "Hvem som helst.",
            responseDeadline: new Date(now.getTime() + 1000),
            status: "closed",
            allowsAnonymousParticipation: true,
            mayBeRecorded: false,
            mayInvolvePhotoVideo: false,
            publishedAt: new Date(closedAt.getTime() - 1000),
            closedAt,
          })
          .returning({ id: requests.id });
        if (!request) throw new Error("Klarte ikke opprette testforespørsel");

        const respondent = await createActiveRecipient();
        const [response] = await db
          .insert(responses)
          .values({
            requestId: request.id,
            respondentId: respondent.id,
            relevanceStatement: "Relevant.",
            answerText: "Svar.",
            contactSharing: "none",
            lifecycleStatus: "submitted",
          })
          .returning({ id: responses.id });
        if (!response) throw new Error("Klarte ikke opprette testsvar");

        return { requestId: request.id, responseId: response.id };
      }

      const old = await makeClosedRequestWithResponse(thirteenMonthsAgo);
      oldRequestId = old.requestId;
      oldResponseId = old.responseId;

      const recent = await makeClosedRequestWithResponse(oneMonthAgo);
      recentRequestId = recent.requestId;
      recentResponseId = recent.responseId;
    });

    afterAll(async () => {
      await db.delete(responses).where(eq(responses.id, recentResponseId));
      await db.delete(requests).where(eq(requests.id, oldRequestId));
      await db.delete(requests).where(eq(requests.id, recentRequestId));
    });

    it("dry run: teller svaret forbi fristen, men sletter INGENTING", async () => {
      setDryRun("true");
      const summary = await runRetention(db);
      const category = summary.results.find((r) => r.category === "responses");
      expect(category?.dryRun).toBe(true);
      expect(category?.affectedCount).toBeGreaterThanOrEqual(1);

      const [stillThere] = await db.select({ id: responses.id }).from(responses).where(eq(responses.id, oldResponseId));
      expect(stillThere).toBeDefined();
    });

    it("ekte kjøring: sletter svaret forbi fristen, lar det NYE svaret stå urørt", async () => {
      setDryRun("false");
      await runRetention(db);

      const [oldGone] = await db.select({ id: responses.id }).from(responses).where(eq(responses.id, oldResponseId));
      expect(oldGone).toBeUndefined();

      const [recentStillThere] = await db
        .select({ id: responses.id })
        .from(responses)
        .where(eq(responses.id, recentResponseId));
      expect(recentStillThere).toBeDefined();
    });
  });

  describe("kontaktforespørsler — 12 måneder etter avslutning", () => {
    let journalistId: string;
    let oldContactRequestId: string;
    let pendingContactRequestId: string;
    let recentContactRequestId: string;

    beforeAll(async () => {
      const journalist = await createActiveJournalist();
      journalistId = journalist.id;

      const now = new Date();
      const thirteenMonthsAgo = new Date(now);
      thirteenMonthsAgo.setUTCMonth(thirteenMonthsAgo.getUTCMonth() - 13);
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setUTCMonth(oneMonthAgo.getUTCMonth() - 1);

      const [old] = await db
        .insert(contactRequests)
        .values({
          journalistId,
          message: "En gammel, avgjort kontaktforespørsel.",
          requestedContactMethod: "e-post",
          status: "declined",
          expiresAt: new Date(thirteenMonthsAgo.getTime() + 14 * 24 * 60 * 60 * 1000),
          updatedAt: thirteenMonthsAgo,
        })
        .returning({ id: contactRequests.id });
      if (!old) throw new Error("Klarte ikke opprette test-kontaktforespørsel");
      oldContactRequestId = old.id;

      // Fortsatt PENDING, men like gammel — skal ALDRI røres, uansett alder
      // (17.4/19.8: kun terminale statuser regnes).
      const [pending] = await db
        .insert(contactRequests)
        .values({
          journalistId,
          message: "En gammel, men fortsatt PENDING kontaktforespørsel.",
          requestedContactMethod: "e-post",
          status: "pending",
          expiresAt: new Date(thirteenMonthsAgo.getTime() + 14 * 24 * 60 * 60 * 1000),
          updatedAt: thirteenMonthsAgo,
        })
        .returning({ id: contactRequests.id });
      if (!pending) throw new Error("Klarte ikke opprette test-kontaktforespørsel");
      pendingContactRequestId = pending.id;

      const [recent] = await db
        .insert(contactRequests)
        .values({
          journalistId,
          message: "En NYLIG avgjort kontaktforespørsel.",
          requestedContactMethod: "e-post",
          status: "approved",
          expiresAt: new Date(oneMonthAgo.getTime() + 14 * 24 * 60 * 60 * 1000),
          updatedAt: oneMonthAgo,
        })
        .returning({ id: contactRequests.id });
      if (!recent) throw new Error("Klarte ikke opprette test-kontaktforespørsel");
      recentContactRequestId = recent.id;
    });

    afterAll(async () => {
      await db.delete(contactRequests).where(eq(contactRequests.id, pendingContactRequestId));
      await db.delete(contactRequests).where(eq(contactRequests.id, recentContactRequestId));
      // oldContactRequestId slettes forventet av selve testen — men rydd
      // opp defensivt uansett, i tilfelle en tidligere assertion feilet.
      await db.delete(contactRequests).where(eq(contactRequests.id, oldContactRequestId));
    });

    it("ekte kjøring: sletter en gammel AVGJORT kontaktforespørsel, men aldri en PENDING eller en NYLIG en", async () => {
      setDryRun("false");
      await runRetention(db);

      const [oldGone] = await db
        .select({ id: contactRequests.id })
        .from(contactRequests)
        .where(eq(contactRequests.id, oldContactRequestId));
      expect(oldGone).toBeUndefined();

      const [pendingStillThere] = await db
        .select({ id: contactRequests.id })
        .from(contactRequests)
        .where(eq(contactRequests.id, pendingContactRequestId));
      expect(pendingStillThere).toBeDefined();

      const [recentStillThere] = await db
        .select({ id: contactRequests.id })
        .from(contactRequests)
        .where(eq(contactRequests.id, recentContactRequestId));
      expect(recentStillThere).toBeDefined();
    });
  });

  describe("avviste journalistsøknader — KUN telling, ALDRI sletting (bevisst ufullstendig)", () => {
    let userId: string;
    let profileId: string;

    beforeAll(async () => {
      const now = new Date();
      const sevenMonthsAgo = new Date(now);
      sevenMonthsAgo.setUTCMonth(sevenMonthsAgo.getUTCMonth() - 7);

      const [user] = await db
        .insert(users)
        .values({
          email: `retention-rejected-${Date.now()}@example.invalid`,
          role: "journalist",
          status: "active",
          countryCode: TEST_COUNTRY_CODE,
          locale: "nb-NO",
          emailVerifiedAt: new Date(),
        })
        .returning({ id: users.id });
      if (!user) throw new Error("Klarte ikke opprette testbruker");
      userId = user.id;

      const [profile] = await db
        .insert(journalistProfiles)
        .values({
          userId,
          fullName: "Avvist Journalist",
          jobTitle: "Journalist",
          organizationName: "Testavisen",
          organizationUrl: "https://example.invalid",
          verificationStatus: "rejected",
          reviewedAt: sevenMonthsAgo,
          reviewNote: "Avvist i test.",
        })
        .returning({ id: journalistProfiles.id });
      if (!profile) throw new Error("Klarte ikke opprette test-journalistprofil");
      profileId = profile.id;
    });

    afterAll(async () => {
      await db.delete(journalistProfiles).where(eq(journalistProfiles.id, profileId));
      await db.delete(users).where(eq(users.id, userId));
    });

    it("teller søknaden forbi 6-månedersfristen i errors[], men sletter INGENTING selv med RETENTION_DRY_RUN=false", async () => {
      setDryRun("false");
      const summary = await runRetention(db);
      const category = summary.results.find((r) => r.category === "rejected_journalist_applications");

      expect(category?.dryRun).toBe(true); // alltid true her, uansett env — se retention.ts
      expect(category?.affectedCount).toBe(0); // "telt", ikke "utført"
      expect(category?.errors.some((e) => e.includes("Ingen handling utført"))).toBe(true);

      const [profileStillThere] = await db
        .select({ id: journalistProfiles.id })
        .from(journalistProfiles)
        .where(eq(journalistProfiles.id, profileId));
      expect(profileStillThere).toBeDefined();

      const [userStillThere] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
      expect(userStillThere).toBeDefined();
    });
  });

  describe("revisjonslogg — 3 år", () => {
    let oldLogId: string;
    let recentLogId: string;

    beforeAll(async () => {
      const now = new Date();
      const fourYearsAgo = new Date(now);
      fourYearsAgo.setUTCFullYear(fourYearsAgo.getUTCFullYear() - 4);
      const oneYearAgo = new Date(now);
      oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);

      const [old] = await db
        .insert(auditLogs)
        .values({
          actorType: "system",
          action: "test.old_entry",
          entityType: "test",
          entityId: "retention-old",
          createdAt: fourYearsAgo,
        })
        .returning({ id: auditLogs.id });
      if (!old) throw new Error("Klarte ikke opprette test-revisjonslogg");
      oldLogId = old.id;

      const [recent] = await db
        .insert(auditLogs)
        .values({
          actorType: "system",
          action: "test.recent_entry",
          entityType: "test",
          entityId: "retention-recent",
          createdAt: oneYearAgo,
        })
        .returning({ id: auditLogs.id });
      if (!recent) throw new Error("Klarte ikke opprette test-revisjonslogg");
      recentLogId = recent.id;
    });

    afterAll(async () => {
      await db.delete(auditLogs).where(eq(auditLogs.id, oldLogId));
      await db.delete(auditLogs).where(eq(auditLogs.id, recentLogId));
    });

    it("ekte kjøring: sletter en logglinje eldre enn 3 år, lar en ett år gammel stå", async () => {
      setDryRun("false");
      await runRetention(db);

      const [oldGone] = await db.select({ id: auditLogs.id }).from(auditLogs).where(eq(auditLogs.id, oldLogId));
      expect(oldGone).toBeUndefined();

      const [recentStillThere] = await db
        .select({ id: auditLogs.id })
        .from(auditLogs)
        .where(eq(auditLogs.id, recentLogId));
      expect(recentStillThere).toBeDefined();
    });
  });

  describe("digest og leveringsstatus — 12 måneder, DigestDelivery før Digest (FK-rekkefølge)", () => {
    let oldDigestId: string;
    let oldDeliveryId: string;
    let recentDigestId: string;
    let recentDeliveryId: string;
    let recipientUserId: string;

    beforeAll(async () => {
      const recipient = await createActiveRecipient();
      recipientUserId = recipient.id;

      const now = new Date();
      const thirteenMonthsAgo = new Date(now);
      thirteenMonthsAgo.setUTCMonth(thirteenMonthsAgo.getUTCMonth() - 13);
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setUTCMonth(oneMonthAgo.getUTCMonth() - 1);

      const [oldDigest] = await db
        .insert(digests)
        .values({
          countryCode: TEST_COUNTRY_CODE,
          scheduledFor: "2024-01-01",
          requestIds: [],
          status: "sent",
          createdAt: thirteenMonthsAgo,
        })
        .returning({ id: digests.id });
      if (!oldDigest) throw new Error("Klarte ikke opprette test-digest");
      oldDigestId = oldDigest.id;

      const [oldDelivery] = await db
        .insert(digestDeliveries)
        .values({
          digestId: oldDigestId,
          userId: recipientUserId,
          locale: "nb-NO",
          accessTokenHash: `old-${Date.now()}`,
          status: "sent",
        })
        .returning({ id: digestDeliveries.id });
      if (!oldDelivery) throw new Error("Klarte ikke opprette test-leveranse");
      oldDeliveryId = oldDelivery.id;

      const [recentDigest] = await db
        .insert(digests)
        .values({
          countryCode: TEST_COUNTRY_CODE,
          scheduledFor: "2026-06-01",
          requestIds: [],
          status: "sent",
          createdAt: oneMonthAgo,
        })
        .returning({ id: digests.id });
      if (!recentDigest) throw new Error("Klarte ikke opprette test-digest");
      recentDigestId = recentDigest.id;

      const [recentDelivery] = await db
        .insert(digestDeliveries)
        .values({
          digestId: recentDigestId,
          userId: recipientUserId,
          locale: "nb-NO",
          accessTokenHash: `recent-${Date.now()}`,
          status: "sent",
        })
        .returning({ id: digestDeliveries.id });
      if (!recentDelivery) throw new Error("Klarte ikke opprette test-leveranse");
      recentDeliveryId = recentDelivery.id;
    });

    afterAll(async () => {
      await db.delete(digestDeliveries).where(eq(digestDeliveries.id, oldDeliveryId));
      await db.delete(digestDeliveries).where(eq(digestDeliveries.id, recentDeliveryId));
      await db.delete(digests).where(eq(digests.id, oldDigestId));
      await db.delete(digests).where(eq(digests.id, recentDigestId));
    });

    it("ekte kjøring: sletter en gammel digest OG dens leveranserad sammen, lar den nye stå", async () => {
      setDryRun("false");
      await runRetention(db);

      const [oldDigestGone] = await db.select({ id: digests.id }).from(digests).where(eq(digests.id, oldDigestId));
      expect(oldDigestGone).toBeUndefined();

      const [oldDeliveryGone] = await db
        .select({ id: digestDeliveries.id })
        .from(digestDeliveries)
        .where(eq(digestDeliveries.id, oldDeliveryId));
      expect(oldDeliveryGone).toBeUndefined();

      const [recentDigestStillThere] = await db
        .select({ id: digests.id })
        .from(digests)
        .where(eq(digests.id, recentDigestId));
      expect(recentDigestStillThere).toBeDefined();
    });
  });
});
