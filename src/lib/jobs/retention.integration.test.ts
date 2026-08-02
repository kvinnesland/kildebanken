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

  describe("innsendte svar — overlever ikke en NYLIG avgjort kontaktforespørsel som fortsatt refererer det (FK-rekkefølge)", () => {
    // createContactRequest()/respondToContactRequest() sjekker aldri den
    // underliggende forespørselens status — en kontaktforespørsel kan derfor
    // opprettes og avgjøres LENGE etter at forespørselen selv lukket.
    // ContactRequest.responseId (schema.ts, 19.8) er nullable og uten
    // CASCADE nettopp fordi kontaktforespørselen har sin EGEN, uavhengige
    // 12-måneders-frist (se "kontaktforespørsler"-blokken under) — den kan
    // fortsatt være innenfor sin frist selv om SVARETS frist (12 måneder
    // etter at forespørselen lukket) allerede er passert. Uten å nulle
    // koblingen før DELETE ville dette krasjet på en fremmednøkkelkonflikt.
    let journalistId: string;
    let requestId: string;
    let responseId: string;
    let contactRequestId: string;

    beforeAll(async () => {
      const journalist = await createActiveJournalist();
      journalistId = journalist.id;

      const now = new Date();
      const thirteenMonthsAgo = new Date(now);
      thirteenMonthsAgo.setUTCMonth(thirteenMonthsAgo.getUTCMonth() - 13);
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setUTCMonth(oneMonthAgo.getUTCMonth() - 1);

      const [request] = await db
        .insert(requests)
        .values({
          journalistId,
          countryCode: TEST_COUNTRY_CODE,
          contentLanguage: "nb-NO",
          title: "Retensjonstest — svar med sen kontaktforespørsel",
          summary: "En testforespørsel for retensjon.",
          description: "Full beskrivelse.",
          targetPersonDescription: "Hvem som helst.",
          responseDeadline: new Date(now.getTime() + 1000),
          status: "closed",
          allowsAnonymousParticipation: true,
          mayBeRecorded: false,
          mayInvolvePhotoVideo: false,
          publishedAt: new Date(thirteenMonthsAgo.getTime() - 1000),
          closedAt: thirteenMonthsAgo,
        })
        .returning({ id: requests.id });
      if (!request) throw new Error("Klarte ikke opprette testforespørsel");
      requestId = request.id;

      const respondent = await createActiveRecipient();
      const [response] = await db
        .insert(responses)
        .values({
          requestId,
          respondentId: respondent.id,
          relevanceStatement: "Relevant.",
          answerText: "Svar.",
          contactSharing: "none",
          lifecycleStatus: "submitted",
        })
        .returning({ id: responses.id });
      if (!response) throw new Error("Klarte ikke opprette testsvar");
      responseId = response.id;

      // Avgjort for BARE én måned siden — godt innenfor SIN egen frist, selv
      // om svaret den peker på allerede er forbi SIN.
      const [contactRequest] = await db
        .insert(contactRequests)
        .values({
          responseId,
          journalistId,
          message: "En kontaktforespørsel opprettet lenge etter at forespørselen lukket.",
          requestedContactMethod: "e-post",
          status: "approved",
          expiresAt: new Date(oneMonthAgo.getTime() + 14 * 24 * 60 * 60 * 1000),
          updatedAt: oneMonthAgo,
        })
        .returning({ id: contactRequests.id });
      if (!contactRequest) throw new Error("Klarte ikke opprette test-kontaktforespørsel");
      contactRequestId = contactRequest.id;
    });

    afterAll(async () => {
      await db.delete(contactRequests).where(eq(contactRequests.id, contactRequestId));
      await db.delete(responses).where(eq(responses.id, responseId));
      await db.delete(requests).where(eq(requests.id, requestId));
    });

    it("ekte kjøring: sletter svaret uten å krasje, og lar den nylig avgjorte kontaktforespørselen overleve (med responseId nullet)", async () => {
      setDryRun("false");
      const summary = await runRetention(db);
      const category = summary.results.find((r) => r.category === "responses");
      expect(category?.errors).toEqual([]);

      const [responseGone] = await db.select({ id: responses.id }).from(responses).where(eq(responses.id, responseId));
      expect(responseGone).toBeUndefined();

      const [contactRequestRow] = await db
        .select({ id: contactRequests.id, responseId: contactRequests.responseId })
        .from(contactRequests)
        .where(eq(contactRequests.id, contactRequestId));
      expect(contactRequestRow).toBeDefined();
      expect(contactRequestRow?.responseId).toBeNull();
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

    it("dry run: teller den gamle AVGJORTE kontaktforespørselen, men sletter INGENTING", async () => {
      setDryRun("true");
      const summary = await runRetention(db);
      const category = summary.results.find((r) => r.category === "contact_requests");
      expect(category?.dryRun).toBe(true);
      expect(category?.affectedCount).toBeGreaterThanOrEqual(1);

      const [stillThere] = await db
        .select({ id: contactRequests.id })
        .from(contactRequests)
        .where(eq(contactRequests.id, oldContactRequestId));
      expect(stillThere).toBeDefined();
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

  describe("avviste journalistsøknader — 6 måneder, full sletting (ferdigstilt økt 7)", () => {
    let oldUserId: string;
    let oldProfileId: string;
    let oldDraftRequestId: string;
    let recentUserId: string;
    let recentProfileId: string;
    let stillPendingUserId: string;
    let stillPendingProfileId: string;

    beforeAll(async () => {
      const now = new Date();
      const sevenMonthsAgo = new Date(now);
      sevenMonthsAgo.setUTCMonth(sevenMonthsAgo.getUTCMonth() - 7);
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setUTCMonth(oneMonthAgo.getUTCMonth() - 1);

      async function createRejectedApplication(reviewedAt: Date) {
        const [user] = await db
          .insert(users)
          .values({
            email: `retention-rejected-${Date.now()}-${Math.random()}@example.invalid`,
            role: "journalist",
            status: "active",
            countryCode: TEST_COUNTRY_CODE,
            locale: "nb-NO",
            emailVerifiedAt: new Date(),
          })
          .returning({ id: users.id });
        if (!user) throw new Error("Klarte ikke opprette testbruker");

        const [profile] = await db
          .insert(journalistProfiles)
          .values({
            userId: user.id,
            fullName: "Avvist Journalist",
            jobTitle: "Journalist",
            organizationName: "Testavisen",
            organizationUrl: "https://example.invalid",
            verificationStatus: "rejected",
            reviewedAt,
            reviewNote: "Avvist i test.",
          })
          .returning({ id: journalistProfiles.id });
        if (!profile) throw new Error("Klarte ikke opprette test-journalistprofil");

        return { userId: user.id, profileId: profile.id };
      }

      const old = await createRejectedApplication(sevenMonthsAgo);
      oldUserId = old.userId;
      oldProfileId = old.profileId;

      // 8.1: `pending_review` OG `rejected` blokkerer begge innsending til
      // moderering — en avvist journalist kan derfor bare ha DRAFT-
      // forespørsler, aldri noe med svar/kontaktforespørsel knyttet til seg.
      const [draftRequest] = await db
        .insert(requests)
        .values({
          journalistId: oldUserId,
          countryCode: TEST_COUNTRY_CODE,
          contentLanguage: "nb-NO",
          status: "draft",
        })
        .returning({ id: requests.id });
      if (!draftRequest) throw new Error("Klarte ikke opprette test-utkast");
      oldDraftRequestId = draftRequest.id;

      const recent = await createRejectedApplication(oneMonthAgo);
      recentUserId = recent.userId;
      recentProfileId = recent.profileId;

      // Fortsatt PENDING_REVIEW, men gammel — skal ALDRI røres, kun
      // `rejected` teller (`verification_status`-filteret i retention.ts).
      const [stillPendingUser] = await db
        .insert(users)
        .values({
          email: `retention-pending-${Date.now()}-${Math.random()}@example.invalid`,
          role: "journalist",
          status: "active",
          countryCode: TEST_COUNTRY_CODE,
          locale: "nb-NO",
          emailVerifiedAt: new Date(),
        })
        .returning({ id: users.id });
      if (!stillPendingUser) throw new Error("Klarte ikke opprette testbruker");
      stillPendingUserId = stillPendingUser.id;

      const [stillPendingProfile] = await db
        .insert(journalistProfiles)
        .values({
          userId: stillPendingUserId,
          fullName: "Ventende Journalist",
          jobTitle: "Journalist",
          organizationName: "Testavisen",
          organizationUrl: "https://example.invalid",
          // verificationStatus defaulter til pending_review — IKKE satt her.
        })
        .returning({ id: journalistProfiles.id });
      if (!stillPendingProfile) throw new Error("Klarte ikke opprette test-journalistprofil");
      stillPendingProfileId = stillPendingProfile.id;
    });

    afterAll(async () => {
      // Best-effort — de fleste av disse er FORVENTET borte etter testen.
      await db.delete(requests).where(eq(requests.id, oldDraftRequestId));
      await db.delete(journalistProfiles).where(eq(journalistProfiles.id, oldProfileId));
      await db.delete(users).where(eq(users.id, oldUserId));
      await db.delete(journalistProfiles).where(eq(journalistProfiles.id, recentProfileId));
      await db.delete(users).where(eq(users.id, recentUserId));
      await db.delete(journalistProfiles).where(eq(journalistProfiles.id, stillPendingProfileId));
      await db.delete(users).where(eq(users.id, stillPendingUserId));
    });

    it("dry run: teller søknaden forbi 6-månedersfristen, men sletter INGENTING", async () => {
      setDryRun("true");
      const summary = await runRetention(db);
      const category = summary.results.find((r) => r.category === "rejected_journalist_applications");
      expect(category?.dryRun).toBe(true);
      expect(category?.affectedCount).toBeGreaterThanOrEqual(1);

      const [stillThere] = await db.select({ id: users.id }).from(users).where(eq(users.id, oldUserId));
      expect(stillThere).toBeDefined();
    });

    it("ekte kjøring: sletter bruker+profil+utkast for den gamle avviste søknaden, lar de andre stå", async () => {
      setDryRun("false");
      await runRetention(db);

      const [oldUserGone] = await db.select({ id: users.id }).from(users).where(eq(users.id, oldUserId));
      expect(oldUserGone).toBeUndefined();
      const [oldProfileGone] = await db
        .select({ id: journalistProfiles.id })
        .from(journalistProfiles)
        .where(eq(journalistProfiles.id, oldProfileId));
      expect(oldProfileGone).toBeUndefined();
      const [oldDraftGone] = await db
        .select({ id: requests.id })
        .from(requests)
        .where(eq(requests.id, oldDraftRequestId));
      expect(oldDraftGone).toBeUndefined();

      // Nylig avvist (innenfor 6 mnd) — urørt.
      const [recentUserStillThere] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, recentUserId));
      expect(recentUserStillThere).toBeDefined();

      // Fortsatt pending_review, uansett alder — urørt (filteret er på
      // verification_status = rejected, ikke bare alder).
      const [stillPendingUserStillThere] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, stillPendingUserId));
      expect(stillPendingUserStillThere).toBeDefined();
    });
  });

  describe("avviste journalistsøknader — en journalist som OGSÅ har slettet kontoen sin selv (auditLogs.actor_user_id)", () => {
    // Reelt hull: performAccountDeletion() (auth/account-deletion.ts) logger
    // en "account.delete"-revisjonsrad med actorUserId = brukerens EGEN id
    // ved selvbetjent sletting — men rører ALDRI journalistProfiles (kun
    // requests/emailSubscriptions/etc). En journalist som FØRST fikk
    // søknaden avvist, og SENERE (uavhengig) sletter kontoen sin selv via
    // /me/request-deletion, etterlater derfor en journalistProfiles-rad med
    // verification_status='rejected' som denne jobben fortsatt finner 6
    // måneder senere — men nå med en auditLogs-rad som refererer
    // users.id via actor_user_id, UTEN CASCADE/SET NULL. Uten å rydde den
    // FØRST ville selve `DELETE FROM users` under feile med et
    // fremmednøkkelbrudd, samme bug-KLASSE som runPurgeUnverified() hadde
    // (task #54) — men her ville feilen aldri forsvinne av seg selv:
    // søknaden ville forbli en "zombie"-kandidat jobben feiler mot hver
    // dag, for alltid.
    let userId: string;
    let profileId: string;
    let auditLogId: string;

    beforeAll(async () => {
      const sevenMonthsAgo = new Date();
      sevenMonthsAgo.setUTCMonth(sevenMonthsAgo.getUTCMonth() - 7);

      const [user] = await db
        .insert(users)
        .values({
          email: `retention-rejected-selfdeleted-${Date.now()}-${Math.random()}@example.invalid`,
          role: "journalist",
          status: "deleted", // allerede slettet selv, se begrunnelse over
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
          fullName: "Avvist Og Selvslettet Journalist",
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

      const [log] = await db
        .insert(auditLogs)
        .values({
          actorType: "user",
          actorUserId: userId,
          action: "account.delete",
          entityType: "user",
          entityId: userId,
        })
        .returning({ id: auditLogs.id });
      if (!log) throw new Error("Klarte ikke opprette test-revisjonslogg");
      auditLogId = log.id;
    });

    afterAll(async () => {
      // Best-effort — forventet borte etter en vellykket fiks.
      await db.delete(auditLogs).where(eq(auditLogs.id, auditLogId));
      await db.delete(journalistProfiles).where(eq(journalistProfiles.id, profileId));
      await db.delete(users).where(eq(users.id, userId));
    });

    it("ekte kjøring: sletter brukeren OG revisjonsloggen, uten et fremmednøkkelbrudd", async () => {
      setDryRun("false");
      const summary = await runRetention(db);

      const category = summary.results.find((r) => r.category === "rejected_journalist_applications");
      expect(category?.errors).toEqual([]);

      const [userGone] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
      expect(userGone).toBeUndefined();
      const [profileGone] = await db
        .select({ id: journalistProfiles.id })
        .from(journalistProfiles)
        .where(eq(journalistProfiles.id, profileId));
      expect(profileGone).toBeUndefined();
      const [logGone] = await db.select({ id: auditLogs.id }).from(auditLogs).where(eq(auditLogs.id, auditLogId));
      expect(logGone).toBeUndefined();
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

    it("dry run: teller logglinjen eldre enn 3 år, men sletter INGENTING", async () => {
      setDryRun("true");
      const summary = await runRetention(db);
      const category = summary.results.find((r) => r.category === "audit_logs");
      expect(category?.dryRun).toBe(true);
      expect(category?.affectedCount).toBeGreaterThanOrEqual(1);

      const [stillThere] = await db.select({ id: auditLogs.id }).from(auditLogs).where(eq(auditLogs.id, oldLogId));
      expect(stillThere).toBeDefined();
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

    it("dry run: teller den gamle digesten, men sletter INGENTING", async () => {
      setDryRun("true");
      const summary = await runRetention(db);
      const category = summary.results.find((r) => r.category === "digests");
      expect(category?.dryRun).toBe(true);
      expect(category?.affectedCount).toBeGreaterThanOrEqual(1);

      const [stillThere] = await db.select({ id: digests.id }).from(digests).where(eq(digests.id, oldDigestId));
      expect(stillThere).toBeDefined();
      const [deliveryStillThere] = await db
        .select({ id: digestDeliveries.id })
        .from(digestDeliveries)
        .where(eq(digestDeliveries.id, oldDeliveryId));
      expect(deliveryStillThere).toBeDefined();
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
