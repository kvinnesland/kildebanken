import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLogs,
  countries,
  journalistProfiles,
  moderatorCountries,
  requests,
  responses,
  users,
} from "@/db/schema";
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
import { closeRequest, createDraft, getPublicRequest, listMineRequests, submitRequest, updateDraft } from "./requests";

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
        geographicNote: "Østlandet",
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

  it("inkluderer geographicNote (SPEC-V1.md 9.1: 'valgfritt fritekst, kun visning' — feltets eneste formål er å bli vist på den offentlige siden)", async () => {
    const found = await getPublicRequest(requestId);
    expect(found?.geographicNote).toBe("Østlandet");
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

  it("nekter en moderator som IKKE er tildelt forespørselens land å lukke den, med errors.not_found (FR-023: skal ikke bekrefte at den finnes i et annet land)", async () => {
    const result = await closeRequest(requestId, moderatorOtherCountryId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("errors.not_found");

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

describe("updateDraft() — slug-genereringen tåler SAMTIDIGE lagringer med samme tittel", () => {
  it("nøyaktig N av N samtidige utkast med SAMME tittel ender opp med N DISTINKTE slugs, aldri en uhåndtert feil", async () => {
    // To (eller flere) journalister som lagrer et utkast med samme/lignende
    // tittel omtrent samtidig kunne begge få samme kandidat fra
    // generateUniqueSlug() før noen av dem rakk å skrive — requests.slug har
    // en unik indeks (requests_slug_idx), og uten fangst ville den tapende
    // UPDATE-en krasje med en uhåndtert 23505 i stedet for å bare prøve en
    // ny kandidat. Samme mønster som countries.integration.test.ts sin
    // createCountry()-samtidighetstest.
    await ensureTestCountry();
    const journalist = await createActiveJournalist();

    const drafts = await Promise.all(
      Array.from({ length: 8 }, () => createDraft(journalist.id))
    );
    const requestIds = drafts.map((d) => {
      if (!d.ok) throw new Error("Klarte ikke opprette utkast");
      return d.id;
    });

    try {
      const results = await Promise.allSettled(
        requestIds.map((id) =>
          updateDraft(id, journalist.id, { title: "Nøyaktig samme tittel for alle utkastene" })
        )
      );

      for (const result of results) {
        expect(result.status).toBe("fulfilled");
        if (result.status === "fulfilled") expect(result.value.ok).toBe(true);
      }

      const rows = await db
        .select({ slug: requests.slug })
        .from(requests)
        .where(inArray(requests.id, requestIds));
      const slugs = rows.map((r) => r.slug);
      expect(slugs).toHaveLength(requestIds.length);
      expect(new Set(slugs).size).toBe(requestIds.length); // alle distinkte
    } finally {
      for (const id of requestIds) {
        await db.delete(requests).where(eq(requests.id, id));
      }
    }
  });
});

// listMineRequests() manglet egne, direkte tester — brukes av
// GET /api/requests/mine og journalist/requests/page.tsx (journalistens
// egen "mine forespørsler"-liste), men ble frem til nå bare berørt
// INDIREKTE av status-badge.test.ts (en komponenttest for en helt annen
// ting). Samme mønster som listModerationQueue()/listActiveRequests()
// hadde tidligere denne økten.
describe("listMineRequests mot ekte Postgres", () => {
  afterEach(async () => {
    await db.delete(requests).where(eq(requests.title, "Testforespørsel for listMineRequests"));
  });

  async function createOwnRequest(journalistId: string, overrides: Partial<typeof requests.$inferInsert> = {}) {
    const [row] = await db
      .insert(requests)
      .values({
        journalistId,
        countryCode: TEST_COUNTRY_CODE,
        contentLanguage: "nb-NO",
        title: "Testforespørsel for listMineRequests",
        summary: "Sammendrag.",
        description: "Beskrivelse.",
        targetPersonDescription: "Hvem som helst.",
        status: "draft",
        allowsAnonymousParticipation: true,
        mayBeRecorded: false,
        mayInvolvePhotoVideo: false,
        ...overrides,
      })
      .returning();
    if (!row) throw new Error("Klarte ikke opprette testforespørsel");
    return row;
  }

  it("ser sine egne forespørsler", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const own = await createOwnRequest(journalist.id);

    const result = await listMineRequests(journalist.id);

    expect(result.map((r) => r.id)).toContain(own.id);
  });

  it("ser ALDRI en annen journalists forespørsler", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const otherJournalist = await createActiveJournalist();
    const own = await createOwnRequest(journalist.id);

    const result = await listMineRequests(otherJournalist.id);

    expect(result.map((r) => r.id)).not.toContain(own.id);
  });

  it("ekskluderer 'deleted'-status (status-badge.ts sin egen forutsetning om at listMineRequests() aldri viser den)", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const deleted = await createOwnRequest(journalist.id, { status: "deleted" });

    const result = await listMineRequests(journalist.id);

    expect(result.map((r) => r.id)).not.toContain(deleted.id);
  });

  it("inkluderer alle andre statuser (f.eks. 'submitted' og 'published')", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const submitted = await createOwnRequest(journalist.id, { status: "submitted" });
    const published = await createOwnRequest(journalist.id, { status: "published", publishedAt: new Date() });

    const result = await listMineRequests(journalist.id);

    expect(result.map((r) => r.id)).toEqual(
      expect.arrayContaining([submitted.id, published.id])
    );
  });
});

describe("submitRequest mot ekte Postgres (draft/changes_requested → submitted, SPEC-V1.md 9.2, 15) — ingen testdekning fantes for denne funksjonen før nå (se NATTLOGG.md)", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  async function createSubmittableDraft(journalistId: string): Promise<string> {
    const created = await createDraft(journalistId);
    if (!created.ok) throw new Error("Klarte ikke opprette utkast");
    const updated = await updateDraft(created.id, journalistId, {
      title: "En testforespørsel til innsending",
      summary: "Sammendrag.",
      description: "Full beskrivelse.",
      targetPersonDescription: "Hvem som helst.",
      responseDeadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      allowsAnonymousParticipation: true,
      mayBeRecorded: false,
      mayInvolvePhotoVideo: false,
    });
    if (!updated.ok) throw new Error(`Klarte ikke fylle ut utkastet: ${JSON.stringify(updated)}`);
    return created.id;
  }

  it("returnerer errors.not_found for en forespørsel journalisten ikke eier", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const otherJournalist = await createActiveJournalist();
    const requestId = await createSubmittableDraft(journalist.id);

    try {
      const result = await submitRequest(requestId, otherJournalist.id);
      expect(result).toEqual({ ok: false, error: "errors.not_found" });
    } finally {
      await db.delete(requests).where(eq(requests.id, requestId));
    }
  });

  it("returnerer errors.request_not_editable for en forespørsel som allerede er submitted", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const requestId = await createSubmittableDraft(journalist.id);

    try {
      const first = await submitRequest(requestId, journalist.id);
      expect(first.ok).toBe(true);

      const result = await submitRequest(requestId, journalist.id);
      expect(result).toEqual({ ok: false, error: "errors.request_not_editable" });
    } finally {
      await db.delete(requests).where(eq(requests.id, requestId));
    }
  });

  it("returnerer errors.not_authorized når journalistens søknad ikke er godkjent ennå (verificationStatus != 'approved')", async () => {
    await ensureTestCountry();
    const email = uniqueTestEmail("journalist-pending");
    const [user] = await db
      .insert(users)
      .values({
        email,
        role: "journalist",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    if (!user) throw new Error("Klarte ikke opprette test-journalist");
    await db.insert(journalistProfiles).values({
      userId: user.id,
      fullName: "Ventende Journalist",
      jobTitle: "Journalist",
      organizationName: "Testavisen",
      organizationUrl: "https://example.invalid",
      verificationStatus: "pending_review",
    });
    const requestId = await createSubmittableDraft(user.id);

    try {
      const result = await submitRequest(requestId, user.id);
      expect(result).toEqual({ ok: false, error: "errors.not_authorized" });
    } finally {
      await db.delete(requests).where(eq(requests.id, requestId));
      await db.delete(journalistProfiles).where(eq(journalistProfiles.userId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
    }
  });

  it("returnerer errors.validation_failed med feltfeil når obligatoriske felter mangler", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const created = await createDraft(journalist.id);
    if (!created.ok) throw new Error("Klarte ikke opprette utkast");

    try {
      const result = await submitRequest(created.id, journalist.id);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("errors.validation_failed");
      expect(result.fieldErrors).toContain("title_required");
    } finally {
      await db.delete(requests).where(eq(requests.id, created.id));
    }
  });

  it("avviser med errors.too_many_published_requests når journalisten allerede har 5 PUBLISERTE (FR-029, tidlig sjekk ved submit — re-sjekkes uansett ved selve publiseringen)", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const publishedIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const [row] = await db
        .insert(requests)
        .values({
          journalistId: journalist.id,
          countryCode: TEST_COUNTRY_CODE,
          contentLanguage: "nb-NO",
          title: `Allerede publisert ${i}`,
          summary: "sum",
          description: "desc",
          targetPersonDescription: "target",
          responseDeadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          status: "published",
          allowsAnonymousParticipation: true,
          mayBeRecorded: false,
          mayInvolvePhotoVideo: false,
          publishedAt: new Date(),
        })
        .returning({ id: requests.id });
      if (row) publishedIds.push(row.id);
    }
    const requestId = await createSubmittableDraft(journalist.id);

    try {
      const result = await submitRequest(requestId, journalist.id);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("errors.too_many_published_requests");
      // SPEC-V1.md 9.2: avvisningen skal "liste hvilke forespørsler
      // journalisten må lukke først" — se requests.ts sin egen kommentar.
      expect(result.blockingRequests?.map((r) => r.id).sort()).toEqual([...publishedIds].sort());
      const [after] = await db.select().from(requests).where(eq(requests.id, requestId));
      expect(after?.status).toBe("draft");
    } finally {
      await db.delete(requests).where(inArray(requests.id, [...publishedIds, requestId]));
    }
  });

  it("bruker LANDETS EGEN grense, ikke en hardkodet 5 (FR-029, SPEC-V1.md 9.2: 'er konfigurasjon, ikke en hardkodet konstant')", async () => {
    // Eget testland med en LAVERE grense (2) enn TEST_COUNTRY_CODE sin
    // DB-standard (5) — beviser at verdien faktisk leses fra
    // countries.max_concurrent_published_requests, ikke en konstant i
    // koden. Reelt hull frem til nå (se NATTLOGG.md): spec-en krevde
    // eksplisitt at grensen skulle være konfigurasjon, men koden hadde en
    // hardkodet `MAX_CONCURRENT_PUBLISHED = 5` i BÅDE denne filen og
    // moderation/requests.ts.
    const lowCapCountryCode = "XV";
    await db
      .insert(countries)
      .values({
        code: lowCapCountryCode,
        nameKey: "country.test.name",
        defaultLocale: "nb-NO",
        availableLocales: ["nb-NO"],
        timezone: "Europe/Oslo",
        minimumAge: 18,
        digestSendTime: "07:00",
        senderNameKey: "email.sender_name.test",
        supportEmail: "test@example.invalid",
        status: "active",
        maxConcurrentPublishedRequests: 2,
      })
      .onConflictDoUpdate({
        target: countries.code,
        set: { maxConcurrentPublishedRequests: 2 },
      });

    const [journalistUser] = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("journalist-low-cap"),
        role: "journalist",
        status: "active",
        countryCode: lowCapCountryCode,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    if (!journalistUser) throw new Error("Klarte ikke opprette test-journalist");
    await db.insert(journalistProfiles).values({
      userId: journalistUser.id,
      fullName: "Test Journalist",
      jobTitle: "Journalist",
      organizationName: "Testavisen",
      organizationUrl: "https://example.invalid",
      verificationStatus: "approved",
    });

    const publishedIds: string[] = [];
    for (let i = 0; i < 2; i++) {
      const [row] = await db
        .insert(requests)
        .values({
          journalistId: journalistUser.id,
          countryCode: lowCapCountryCode,
          contentLanguage: "nb-NO",
          title: `Allerede publisert (lavt tak) ${i}`,
          summary: "sum",
          description: "desc",
          targetPersonDescription: "target",
          responseDeadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          status: "published",
          allowsAnonymousParticipation: true,
          mayBeRecorded: false,
          mayInvolvePhotoVideo: false,
          publishedAt: new Date(),
        })
        .returning({ id: requests.id });
      if (row) publishedIds.push(row.id);
    }
    const requestId = await createSubmittableDraft(journalistUser.id);

    try {
      const result = await submitRequest(requestId, journalistUser.id);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("errors.too_many_published_requests");
      expect(result.blockingRequests?.map((r) => r.id).sort()).toEqual([...publishedIds].sort());
    } finally {
      await db.delete(requests).where(inArray(requests.id, [...publishedIds, requestId]));
    }
  });

  it("setter status til submitted og varsler ALLE moderatorer tildelt landet (SPEC-V1.md 15: 'Ny forespørsel til moderering')", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const [moderator] = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("moderator-for-submit"),
        role: "moderator",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    if (!moderator) throw new Error("Klarte ikke opprette test-moderator");
    await db.insert(moderatorCountries).values({ moderatorUserId: moderator.id, countryCode: TEST_COUNTRY_CODE });
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const requestId = await createSubmittableDraft(journalist.id);

    try {
      const result = await submitRequest(requestId, journalist.id);

      expect(result.ok).toBe(true);
      const [after] = await db.select().from(requests).where(eq(requests.id, requestId));
      expect(after?.status).toBe("submitted");
      expect(
        warnSpy.mock.calls.some((call) => String(call[0]).includes("new_request_for_moderation"))
      ).toBe(true);
      expect(
        warnSpy.mock.calls.some((call) => String(call[0]).includes("En testforespørsel til innsending"))
      ).toBe(true);
    } finally {
      await db.delete(requests).where(eq(requests.id, requestId));
      await db.delete(moderatorCountries).where(eq(moderatorCountries.moderatorUserId, moderator.id));
      await db.delete(users).where(eq(users.id, moderator.id));
    }
  });
});
