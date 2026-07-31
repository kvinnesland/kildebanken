import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, moderatorCountries, requests, responses, users } from "@/db/schema";
import {
  createActiveJournalist,
  createActiveRecipient,
  ensureSecondTestCountry,
  ensureTestCountry,
  TEST_COUNTRY_CODE,
  TEST_COUNTRY_CODE_2,
  uniqueTestEmail,
} from "@/db/integration/fixtures";
import { submitResponse } from "@/lib/responses/responses";
import { closeRequest, createDraft, getPublicRequest, updateDraft } from "./requests";

describe("getPublicRequest mot ekte Postgres", () => {
  let journalistId: string;
  let requestId: string;

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
        title: "Synlighetstest",
        summary: "En testforespørsel for synlighetsregelen.",
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
  });

  afterAll(async () => {
    await db.delete(requests).where(eq(requests.id, requestId));
  });

  it("er offentlig synlig så lenge journalisten er aktiv", async () => {
    const found = await getPublicRequest(requestId);
    expect(found?.id).toBe(requestId);
  });

  it("inkluderer landets tidssone (SPEC-V1.md 11: 'svarfrist med tidssone')", async () => {
    const found = await getPublicRequest(requestId);
    expect(found?.countryCode).toBe(TEST_COUNTRY_CODE);
    expect(found?.countryTimezone).toBe("Europe/Oslo");
  });

  it("skjules umiddelbart når eierens konto suspenderes, og vises igjen når den gjenopprettes (8.1)", async () => {
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, journalistId));
    const hidden = await getPublicRequest(requestId);
    expect(hidden).toBeNull();

    await db.update(users).set({ status: "active" }).where(eq(users.id, journalistId));
    const visibleAgain = await getPublicRequest(requestId);
    expect(visibleAgain?.id).toBe(requestId);
  });
});

describe("closeRequest mot ekte Postgres — moderator er begrenset til tildelt land (4)", () => {
  let journalistId: string;
  let requestId: string;
  let moderatorOtherCountryId: string;
  let moderatorSameCountryId: string;

  beforeAll(async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();

    const journalist = await createActiveJournalist();
    journalistId = journalist.id;

    const [request] = await db
      .insert(requests)
      .values({
        journalistId,
        countryCode: TEST_COUNTRY_CODE,
        contentLanguage: "nb-NO",
        title: "Lukketest",
        summary: "En testforespørsel for lukkeautorisasjon.",
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

    const [moderatorOtherCountry] = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("moderator-other-country"),
        role: "moderator",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    if (!moderatorOtherCountry) throw new Error("Klarte ikke opprette testmoderator");
    moderatorOtherCountryId = moderatorOtherCountry.id;
    await db
      .insert(moderatorCountries)
      .values({ moderatorUserId: moderatorOtherCountryId, countryCode: TEST_COUNTRY_CODE_2 });

    const [moderatorSameCountry] = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("moderator-same-country"),
        role: "moderator",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    if (!moderatorSameCountry) throw new Error("Klarte ikke opprette testmoderator");
    moderatorSameCountryId = moderatorSameCountry.id;
    await db
      .insert(moderatorCountries)
      .values({ moderatorUserId: moderatorSameCountryId, countryCode: TEST_COUNTRY_CODE });
  });

  afterAll(async () => {
    await db.delete(auditLogs).where(eq(auditLogs.entityId, requestId));
    await db.delete(moderatorCountries).where(eq(moderatorCountries.moderatorUserId, moderatorOtherCountryId));
    await db.delete(moderatorCountries).where(eq(moderatorCountries.moderatorUserId, moderatorSameCountryId));
    await db.delete(users).where(eq(users.id, moderatorOtherCountryId));
    await db.delete(users).where(eq(users.id, moderatorSameCountryId));
    await db.delete(requests).where(eq(requests.id, requestId));
  });

  it("nekter en moderator som IKKE er tildelt forespørselens land å lukke den", async () => {
    const result = await closeRequest(requestId, moderatorOtherCountryId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("errors.not_authorized");

    const [row] = await db.select({ status: requests.status }).from(requests).where(eq(requests.id, requestId));
    expect(row?.status).toBe("published");
  });

  it("lar en moderator tildelt SAMME land lukke forespørselen, og logger handlingen (FR-050)", async () => {
    const result = await closeRequest(requestId, moderatorSameCountryId);
    expect(result.ok).toBe(true);

    const [row] = await db.select({ status: requests.status }).from(requests).where(eq(requests.id, requestId));
    expect(row?.status).toBe("closed");

    const [log] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, requestId), eq(auditLogs.action, "request.close")));
    expect(log?.actorUserId).toBe(moderatorSameCountryId);
    expect(log?.countryCode).toBe(TEST_COUNTRY_CODE);
  });
});

describe("closeRequest mot ekte Postgres — varsler respondenter (SPEC-V1.md 15: 'Forespørsel du har svart på er lukket')", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("sender response_request_closed til en respondent med et INNSENDT svar, når journalisten lukker forespørselen selv", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const respondent = await createActiveRecipient();

    const [request] = await db
      .insert(requests)
      .values({
        journalistId: journalist.id,
        countryCode: TEST_COUNTRY_CODE,
        contentLanguage: "nb-NO",
        title: "Lukketest med respondentvarsel",
        summary: "sum",
        description: "desc",
        targetPersonDescription: "target",
        responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "published",
        allowsAnonymousParticipation: true,
        mayBeRecorded: false,
        mayInvolvePhotoVideo: false,
        publishedAt: new Date(),
      })
      .returning({ id: requests.id });
    if (!request) throw new Error("Klarte ikke opprette testforespørsel");

    const submitResult = await submitResponse(request.id, respondent.id, {
      relevanceStatement: "Relevant.",
      answerText: "Svar.",
      contactSharing: "none",
    });
    if (!submitResult.ok) throw new Error("Klarte ikke sende inn testsvar");

    const result = await closeRequest(request.id, journalist.id);

    expect(result.ok).toBe(true);
    expect(
      warnSpy.mock.calls.some((call) => String(call[0]).includes("response_request_closed"))
    ).toBe(true);
    expect(
      warnSpy.mock.calls.some(
        (call) => String(call[0]).includes(respondent.email) && String(call[0]).includes("response_request_closed")
      )
    ).toBe(true);

    await db.delete(responses).where(eq(responses.requestId, request.id));
    await db.delete(requests).where(eq(requests.id, request.id));
  });
});

describe("updateDraft mot ekte Postgres — responseDeadlineLocal tolkes i LANDETS tidssone (9.1)", () => {
  let journalistId: string;
  let requestId: string;

  beforeAll(async () => {
    await ensureTestCountry(); // TEST_COUNTRY_CODE sin tidssone er Europe/Oslo
    const journalist = await createActiveJournalist();
    journalistId = journalist.id;

    const created = await createDraft(journalistId);
    if (!created.ok) throw new Error("Klarte ikke opprette utkast");
    requestId = created.id;
  });

  afterAll(async () => {
    await db.delete(requests).where(eq(requests.id, requestId));
  });

  it("konverterer en sommerdato (CEST, UTC+2) til riktig UTC-tidspunkt, ikke bare lagrer klokkeslettet rått", async () => {
    const result = await updateDraft(requestId, journalistId, {
      responseDeadlineLocal: "2026-08-15T14:00",
    });
    expect(result.ok).toBe(true);

    const [row] = await db
      .select({ responseDeadline: requests.responseDeadline })
      .from(requests)
      .where(eq(requests.id, requestId));
    expect(row?.responseDeadline?.toISOString()).toBe("2026-08-15T12:00:00.000Z");
  });
});

describe("createDraft — hastighetsgrense (SPEC-V1.md 18: 20 opprettelser per journalist per døgn)", () => {
  it("avviser den 21. opprettelsen innen samme døgn, med errors.rate_limited", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const createdIds: string[] = [];

    try {
      for (let i = 0; i < 20; i++) {
        const result = await createDraft(journalist.id);
        expect(result.ok).toBe(true);
        if (result.ok) createdIds.push(result.id);
      }

      const twentyFirst = await createDraft(journalist.id);

      expect(twentyFirst.ok).toBe(false);
      if (!twentyFirst.ok) expect(twentyFirst.error).toBe("errors.rate_limited");
    } finally {
      for (const id of createdIds) {
        await db.delete(requests).where(eq(requests.id, id));
      }
    }
  });
});
