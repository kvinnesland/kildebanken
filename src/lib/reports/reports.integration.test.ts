import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { moderatorCountries, requests, responses, users } from "@/db/schema";
import {
  createActiveJournalist,
  createActiveRecipient,
  ensureTestCountry,
  TEST_COUNTRY_CODE,
  uniqueTestEmail,
} from "@/db/integration/fixtures";
import { submitReport } from "./reports";

describe("submitReport mot ekte Postgres", () => {
  let journalistId: string;
  let requestId: string;
  let responseId: string;
  let moderatorId: string;

  beforeAll(async () => {
    await ensureTestCountry();

    const journalist = await createActiveJournalist();
    journalistId = journalist.id;

    const [request] = await db
      .insert(requests)
      .values({
        journalistId,
        countryCode: TEST_COUNTRY_CODE,
        contentLanguage: "nb-NO",
        title: "Testforespørsel for rapportering",
        summary: "En testforespørsel.",
        description: "Full beskrivelse.",
        targetPersonDescription: "Hvem som helst.",
        responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "published",
        allowsAnonymousParticipation: true,
        mayBeRecorded: false,
        mayInvolvePhotoVideo: false,
        publishedAt: new Date(),
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
        relevanceStatement: "Relevant fordi X.",
        answerText: "Svar.",
        contactSharing: "none",
        lifecycleStatus: "submitted",
      })
      .returning({ id: responses.id });
    if (!response) throw new Error("Klarte ikke opprette testsvar");
    responseId = response.id;

    const [moderator] = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("moderator"),
        role: "moderator",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    if (!moderator) throw new Error("Klarte ikke opprette testmoderator");
    moderatorId = moderator.id;

    await db.insert(moderatorCountries).values({
      moderatorUserId: moderatorId,
      countryCode: TEST_COUNTRY_CODE,
    });
  });

  afterAll(async () => {
    await db.delete(moderatorCountries).where(eq(moderatorCountries.moderatorUserId, moderatorId));
    await db.delete(users).where(eq(users.id, moderatorId));
    await db.delete(responses).where(eq(responses.requestId, requestId));
    await db.delete(requests).where(eq(requests.id, requestId));
  });

  it("finner riktig land for en rapportert FORESPØRSEL og sender (uten å feile)", async () => {
    const result = await submitReport({
      entityType: "request",
      entityId: requestId,
      reason: "Upassende innhold",
    });
    expect(result.ok).toBe(true);
  });

  it("finner riktig land for et rapportert SVAR (via forespørselen det tilhører)", async () => {
    const result = await submitReport({
      entityType: "response",
      entityId: responseId,
      reason: "Upassende innhold",
      comment: "En kommentar til.",
    });
    expect(result.ok).toBe(true);
  });

  it("avviser en ukjent entity_id", async () => {
    const result = await submitReport({
      entityType: "request",
      entityId: "00000000-0000-0000-0000-000000000000",
      reason: "Upassende innhold",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("errors.not_found");
  });

  it("avviser en tom begrunnelse", async () => {
    const result = await submitReport({
      entityType: "request",
      entityId: requestId,
      reason: "   ",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("errors.validation_failed");
  });
});
