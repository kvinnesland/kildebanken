import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, countries, journalistProfiles, moderatorCountries, requests, sessions, users } from "@/db/schema";
import {
  ensureSecondTestCountry,
  ensureTestCountry,
  TEST_COUNTRY_CODE,
  TEST_COUNTRY_CODE_2,
  uniqueTestEmail,
} from "@/db/integration/fixtures";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import type { CurrentSession } from "@/lib/auth/session";
import { listActiveRequests, listModerationQueue, publishRequest, rejectRequest, requestChanges } from "./requests";

// publishRequest()/rejectRequest()/requestChanges() kaller
// requireModeratorForCountry() internt, som leser getCurrentSession() (en
// next/headers-cookie) — en ekte sesjonsavhengighet som IKKE lar seg løse
// med bare et `export`-nøkkelord (i motsetning til tick.ts sine
// jobbfunksjoner, se NATTLOGG.md). Mocker `next/headers` i stedet for å
// endre kallekonvensjonen i produksjonskoden — økten ELLERS lagres og leses
// fra EKTE Postgres (en ekte `sessions`-rad, hentet via en ekte rå token),
// bare selve cookie-oppslaget er stanget ut.
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
import { cookies } from "next/headers";

async function loginAs(userId: string): Promise<void> {
  const rawToken = generateToken();
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) => (name === "kb_session" ? { name, value: rawToken } : undefined),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

// Alle moderatorer denne filen oppretter, på tvers av ALLE describe-
// blokkene under — hver blokks egen `afterEach` rydder kun opp
// forespørslene den selv opererer på, aldri moderatorene. Reelt hull
// oppdaget under Økt 36s arbeid med submitRequest()-tester (se
// NATTLOGG.md): stadig flere moderator-e-poster dukket opp i loggen ved
// gjentatte kjøringer av HELE testfilen. Ryddes samlet i én `afterAll`
// nederst i filen i stedet for i hver enkelt blokk, siden funksjonen
// brukes fra tre forskjellige describe-blokker.
const createdModeratorIds: string[] = [];

async function createModerator(countryCode: string): Promise<{ id: string }> {
  const [moderator] = await db
    .insert(users)
    .values({
      email: uniqueTestEmail("moderator"),
      role: "moderator",
      status: "active",
      countryCode,
      locale: "nb-NO",
      emailVerifiedAt: new Date(),
    })
    .returning({ id: users.id });
  if (!moderator) throw new Error("Klarte ikke opprette test-moderator");
  await db.insert(moderatorCountries).values({ moderatorUserId: moderator.id, countryCode });
  createdModeratorIds.push(moderator.id);
  return moderator;
}

async function createSubmittedRequest(
  journalistId: string,
  overrides: Partial<typeof requests.$inferInsert> = {}
) {
  const [row] = await db
    .insert(requests)
    .values({
      journalistId,
      countryCode: TEST_COUNTRY_CODE,
      contentLanguage: "nb-NO",
      slug: `test-${randomUUID()}`,
      title: "Testforespørsel til moderering",
      summary: "Sammendrag.",
      description: "Beskrivelse.",
      targetPersonDescription: "Hvem som helst.",
      status: "submitted",
      allowsAnonymousParticipation: true,
      mayBeRecorded: false,
      mayInvolvePhotoVideo: false,
      responseDeadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      ...overrides,
    })
    .returning();
  if (!row) throw new Error("Klarte ikke opprette testforespørsel");
  return row;
}

async function createActiveJournalistPlain(countryCode: string): Promise<{ id: string; email: string }> {
  const email = uniqueTestEmail("journalist-plain");
  const [user] = await db
    .insert(users)
    .values({
      email,
      role: "journalist",
      status: "active",
      countryCode,
      locale: "nb-NO",
      emailVerifiedAt: new Date(),
    })
    .returning({ id: users.id });
  if (!user) throw new Error("Klarte ikke opprette test-journalist");
  return { id: user.id, email };
}

// listModerationQueue()/listActiveRequests() innerJoin'er journalistProfiles
// (for VISNING — se doc-kommentaren over listModerationQueue()), ulikt
// publishRequest()/rejectRequest()/requestChanges() som ikke trenger den —
// createActiveJournalistPlain() over holder seg derfor bevisst uendret
// (mange eksisterende tester bruker den), og denne EGNE varianten legger
// til profilraden bare der den faktisk trengs.
async function createActiveJournalistWithProfile(countryCode: string): Promise<{ id: string }> {
  const journalist = await createActiveJournalistPlain(countryCode);
  await db.insert(journalistProfiles).values({
    userId: journalist.id,
    fullName: "Test Journalist",
    jobTitle: "Journalist",
    organizationName: "Testavisen",
    organizationUrl: "https://example.invalid",
    verificationStatus: "approved",
  });
  return { id: journalist.id };
}

describe("publishRequest/rejectRequest/requestChanges mot ekte Postgres", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await db.delete(requests).where(eq(requests.title, "Testforespørsel til moderering"));
  });

  it("publishRequest(): en moderator tildelt SAMME land kan publisere en innsendt forespørsel", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const journalist = await createActiveJournalistPlain(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    const request = await createSubmittedRequest(journalist.id);
    await loginAs(moderator.id);

    const result = await publishRequest(request.id);

    expect(result.ok).toBe(true);
    const [after] = await db.select().from(requests).where(eq(requests.id, request.id));
    expect(after?.status).toBe("published");
    expect(after?.moderatedBy).toBe(moderator.id);
    expect(
      warnSpy.mock.calls.some((call) => String(call[0]).includes("request_approved_published"))
    ).toBe(true);
  });

  it("publishRequest(): en moderator tildelt et ANNET land nektes med errors.not_found (FR-023, SPEC-V1.md 4: skal ikke bekrefte at forespørselen finnes i et annet land)", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const journalist = await createActiveJournalistPlain(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE_2);
    const request = await createSubmittedRequest(journalist.id);
    await loginAs(moderator.id);

    const result = await publishRequest(request.id);

    expect(result).toEqual({ ok: false, error: "errors.not_found" });
    const [after] = await db.select().from(requests).where(eq(requests.id, request.id));
    expect(after?.status).toBe("submitted");
  });

  it("publishRequest(): en journalist (ikke moderator/administrator) nektes", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalistPlain(TEST_COUNTRY_CODE);
    const request = await createSubmittedRequest(journalist.id);
    await loginAs(journalist.id);

    const result = await publishRequest(request.id);

    expect(result).toEqual({ ok: false, error: "errors.not_authorized" });
  });

  it("publishRequest(): respekterer FR-029 — nekter en sjette samtidig publiserte forespørsel", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const journalist = await createActiveJournalistPlain(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    try {
      for (let i = 0; i < 5; i++) {
        const submitted = await createSubmittedRequest(journalist.id, {
          title: `Testforespørsel til moderering ${i}`,
        });
        const result = await publishRequest(submitted.id);
        expect(result.ok).toBe(true);
      }

      const sixth = await createSubmittedRequest(journalist.id, {
        title: "Testforespørsel til moderering 5",
      });
      const sixthResult = await publishRequest(sixth.id);

      expect(sixthResult).toEqual({ ok: false, error: "errors.too_many_published_requests" });
      const [after] = await db.select().from(requests).where(eq(requests.id, sixth.id));
      expect(after?.status).toBe("submitted");
    } finally {
      await db.delete(requests).where(eq(requests.journalistId, journalist.id));
    }
  });

  it("publishRequest(): bruker LANDETS EGEN grense, ikke en hardkodet 5 (FR-029, SPEC-V1.md 9.2: 'er konfigurasjon, ikke en hardkodet konstant')", async () => {
    // Samme rettelse og samme lav-tak-testland ("XV") som den tilsvarende
    // testen i requests/requests.integration.test.ts (se NATTLOGG.md) — men
    // her for RE-sjekken ved selve publiseringen, ikke bare den tidlige
    // sjekken ved submit.
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

    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const journalist = await createActiveJournalistPlain(lowCapCountryCode);
    const moderator = await createModerator(lowCapCountryCode);
    await loginAs(moderator.id);

    try {
      for (let i = 0; i < 2; i++) {
        const submitted = await createSubmittedRequest(journalist.id, {
          countryCode: lowCapCountryCode,
          title: `Testforespørsel til moderering (lavt tak) ${i}`,
        });
        const result = await publishRequest(submitted.id);
        expect(result.ok).toBe(true);
      }

      const third = await createSubmittedRequest(journalist.id, {
        countryCode: lowCapCountryCode,
        title: "Testforespørsel til moderering (lavt tak) 2",
      });
      const thirdResult = await publishRequest(third.id);

      expect(thirdResult).toEqual({ ok: false, error: "errors.too_many_published_requests" });
      const [after] = await db.select().from(requests).where(eq(requests.id, third.id));
      expect(after?.status).toBe("submitted");
    } finally {
      await db.delete(requests).where(eq(requests.journalistId, journalist.id));
    }
  });

  it("publishRequest(): FR-029 holder OGSÅ når to ULIKE innsendte forespørsler godkjennes SAMTIDIG (TOCTOU)", async () => {
    // publishRequest() sin egen atomiske WHERE-betingelse (status='submitted'
    // i selve UPDATE-en) hindrer bare at SAMME rad publiseres to ganger — den
    // sier ingenting om hvor mange AV JOURNALISTENS ANDRE forespørsler som
    // publiseres i samme øyeblikk. Tellingen over (linje 62-69 i
    // moderation/requests.ts) er en ren SELECT COUNT uten noen sperre — to
    // moderatorer (eller to faner) som godkjenner to FORSKJELLIGE innsendte
    // forespørsler fra SAMME journalist, akkurat idet journalisten allerede
    // har 4 publiserte, kunne begge lese count=4, begge bestå sjekken, og
    // begge lykkes — 6 publiserte, i strid med FR-029s harde 5-grense.
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const journalist = await createActiveJournalistPlain(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    try {
      for (let i = 0; i < 4; i++) {
        const submitted = await createSubmittedRequest(journalist.id, {
          title: `Testforespørsel til moderering (allerede publisert) ${i}`,
        });
        const result = await publishRequest(submitted.id);
        expect(result.ok).toBe(true);
      }

      const candidates = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          createSubmittedRequest(journalist.id, { title: `Kappløps-kandidat ${i}` })
        )
      );

      const raceResults = await Promise.all(candidates.map((c) => publishRequest(c.id)));

      const [published] = await db
        .select({ value: count() })
        .from(requests)
        .where(and(eq(requests.journalistId, journalist.id), eq(requests.status, "published")));
      expect(published?.value ?? 0).toBeLessThanOrEqual(5);

      // Nøyaktig ETT av de åtte samtidige kallene skal ha lyktes (4 → 5) —
      // resten skal ha blitt avvist med FR-029s feilkode, IKKE stille
      // sluppet gjennom.
      const oks = raceResults.filter((r) => r.ok);
      expect(oks).toHaveLength(1);
      for (const r of raceResults) {
        if (!r.ok) expect(r).toEqual({ ok: false, error: "errors.too_many_published_requests" });
      }
    } finally {
      await db.delete(requests).where(eq(requests.journalistId, journalist.id));
    }
  });

  it("rejectRequest(): krever en ikke-tom begrunnelse", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalistPlain(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    const request = await createSubmittedRequest(journalist.id);
    await loginAs(moderator.id);

    const result = await rejectRequest(request.id, "   ");

    expect(result).toEqual({ ok: false, error: "errors.reason_required" });
  });

  it("rejectRequest(): avviser med begrunnelse og varsler journalisten", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const journalist = await createActiveJournalistPlain(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    const request = await createSubmittedRequest(journalist.id);
    await loginAs(moderator.id);

    const result = await rejectRequest(request.id, "Manglet legitimt journalistisk formål.");

    expect(result.ok).toBe(true);
    const [after] = await db.select().from(requests).where(eq(requests.id, request.id));
    expect(after?.status).toBe("rejected");
    expect(after?.moderatorComment).toBe("Manglet legitimt journalistisk formål.");
    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes("request_rejected"))).toBe(true);
  });

  it("requestChanges(): krever en ikke-tom kommentar", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalistPlain(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    const request = await createSubmittedRequest(journalist.id);
    await loginAs(moderator.id);

    const result = await requestChanges(request.id, "");

    expect(result).toEqual({ ok: false, error: "errors.reason_required" });
  });

  it("requestChanges(): setter status til changes_requested og varsler journalisten", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const journalist = await createActiveJournalistPlain(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    const request = await createSubmittedRequest(journalist.id);
    await loginAs(moderator.id);

    const result = await requestChanges(request.id, "Vær mer spesifikk om tidsrommet.");

    expect(result.ok).toBe(true);
    const [after] = await db.select().from(requests).where(eq(requests.id, request.id));
    expect(after?.status).toBe("changes_requested");
    expect(after?.moderatorComment).toBe("Vær mer spesifikk om tidsrommet.");
    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes("changes_requested"))).toBe(true);
  });

  it("rejectRequest(): en moderator tildelt et ANNET land nektes med errors.not_found (FR-023)", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const journalist = await createActiveJournalistPlain(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE_2);
    const request = await createSubmittedRequest(journalist.id);
    await loginAs(moderator.id);

    const result = await rejectRequest(request.id, "En begrunnelse.");

    expect(result).toEqual({ ok: false, error: "errors.not_found" });
    const [after] = await db.select().from(requests).where(eq(requests.id, request.id));
    expect(after?.status).toBe("submitted");
  });

  it("requestChanges(): en moderator tildelt et ANNET land nektes med errors.not_found (FR-023)", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const journalist = await createActiveJournalistPlain(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE_2);
    const request = await createSubmittedRequest(journalist.id);
    await loginAs(moderator.id);

    const result = await requestChanges(request.id, "En kommentar.");

    expect(result).toEqual({ ok: false, error: "errors.not_found" });
    const [after] = await db.select().from(requests).where(eq(requests.id, request.id));
    expect(after?.status).toBe("submitted");
  });

  it("en administrator kan publisere UANSETT land (19.4: trenger ingen moderator_countries-rad)", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const journalist = await createActiveJournalistPlain(TEST_COUNTRY_CODE);
    const request = await createSubmittedRequest(journalist.id);

    const [admin] = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("admin"),
        role: "admin",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    if (!admin) throw new Error("Klarte ikke opprette test-administrator");
    // Ryddes i SAMME afterAll som moderatorene nederst i filen — en
    // administrator har ingen moderator_countries-rad, så den delete er
    // et trygt no-op for denne IDen.
    createdModeratorIds.push(admin.id);
    await loginAs(admin.id);

    const result = await publishRequest(request.id);

    expect(result.ok).toBe(true);
  });
});

// listActiveRequests(), i likhet med listModerationQueue(), tar en allerede
// utledet CurrentSession direkte (kaller ikke getCurrentSession() selv) —
// samme mønster og begrunnelse som makeSession() i
// src/lib/admin/dashboard.integration.test.ts, ingen next/headers-mocking
// nødvendig for DISSE testene.
function makeSession(overrides: Partial<CurrentSession> = {}): CurrentSession {
  return {
    sessionId: "session-id",
    userId: "user-id",
    role: "moderator",
    countryCode: TEST_COUNTRY_CODE,
    locale: "nb-NO",
    email: "test@example.invalid",
    displayName: null,
    ...overrides,
  };
}

describe("listActiveRequests mot ekte Postgres", () => {
  afterEach(async () => {
    await db.delete(requests).where(eq(requests.title, "Testforespørsel til moderering"));
  });

  it("en moderator tildelt SAMME land ser en publisert forespørsel for det landet", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalistWithProfile(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    const published = await createSubmittedRequest(journalist.id, {
      status: "published",
      publishedAt: new Date(),
    });

    const result = await listActiveRequests(
      makeSession({ userId: moderator.id, role: "moderator", countryCode: TEST_COUNTRY_CODE })
    );

    expect(result.map((r) => r.id)).toContain(published.id);
  });

  it("en moderator tildelt et ANNET land ser IKKE forespørselen", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const journalist = await createActiveJournalistWithProfile(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE_2);
    const published = await createSubmittedRequest(journalist.id, {
      status: "published",
      publishedAt: new Date(),
    });

    const result = await listActiveRequests(
      makeSession({ userId: moderator.id, role: "moderator", countryCode: TEST_COUNTRY_CODE_2 })
    );

    expect(result.map((r) => r.id)).not.toContain(published.id);
  });

  it("en administrator ser aktive forespørsler UANSETT land", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalistWithProfile(TEST_COUNTRY_CODE);
    const published = await createSubmittedRequest(journalist.id, {
      status: "published",
      publishedAt: new Date(),
    });

    const result = await listActiveRequests(makeSession({ role: "admin", countryCode: TEST_COUNTRY_CODE_2 }));

    expect(result.map((r) => r.id)).toContain(published.id);
  });

  it("inkluderer ALDRI en forespørsel som ikke er publisert (f.eks. fortsatt til vurdering)", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalistWithProfile(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    const submitted = await createSubmittedRequest(journalist.id);

    const result = await listActiveRequests(
      makeSession({ userId: moderator.id, role: "moderator", countryCode: TEST_COUNTRY_CODE })
    );

    expect(result.map((r) => r.id)).not.toContain(submitted.id);
  });
});

// listModerationQueue() manglet, i likhet med listActiveRequests() før
// forrige økt, egne DIREKTE tester — den ble frem til nå bare testet
// INDIREKTE via at publishRequest()/rejectRequest()/requestChanges() selv
// fungerer, aldri en test som kaller listModerationQueue() selv og
// sjekker landfiltrering/innhold. Samme mønster som beskrevet for
// listActiveRequests() over.
describe("listModerationQueue mot ekte Postgres", () => {
  afterEach(async () => {
    await db.delete(requests).where(eq(requests.title, "Testforespørsel til moderering"));
  });

  it("en moderator tildelt SAMME land ser en innsendt forespørsel for det landet", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalistWithProfile(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    const submitted = await createSubmittedRequest(journalist.id);

    const result = await listModerationQueue(
      makeSession({ userId: moderator.id, role: "moderator", countryCode: TEST_COUNTRY_CODE })
    );

    expect(result.map((r) => r.id)).toContain(submitted.id);
  });

  it("en moderator tildelt et ANNET land ser IKKE forespørselen", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const journalist = await createActiveJournalistWithProfile(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE_2);
    const submitted = await createSubmittedRequest(journalist.id);

    const result = await listModerationQueue(
      makeSession({ userId: moderator.id, role: "moderator", countryCode: TEST_COUNTRY_CODE_2 })
    );

    expect(result.map((r) => r.id)).not.toContain(submitted.id);
  });

  it("en administrator ser innsendte forespørsler UANSETT land", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalistWithProfile(TEST_COUNTRY_CODE);
    const submitted = await createSubmittedRequest(journalist.id);

    const result = await listModerationQueue(makeSession({ role: "admin", countryCode: TEST_COUNTRY_CODE_2 }));

    expect(result.map((r) => r.id)).toContain(submitted.id);
  });

  it("inkluderer ALDRI en forespørsel som allerede er behandlet (f.eks. publisert)", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalistWithProfile(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    const published = await createSubmittedRequest(journalist.id, {
      status: "published",
      publishedAt: new Date(),
    });

    const result = await listModerationQueue(
      makeSession({ userId: moderator.id, role: "moderator", countryCode: TEST_COUNTRY_CODE })
    );

    expect(result.map((r) => r.id)).not.toContain(published.id);
  });

  it("en moderator uten noe tildelt land ser en tom liste, ikke ALLE land (aldri feilåpen)", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalistWithProfile(TEST_COUNTRY_CODE);
    await createSubmittedRequest(journalist.id);

    const [unassignedModerator] = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("moderator-unassigned"),
        role: "moderator",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    if (!unassignedModerator) throw new Error("Klarte ikke opprette test-moderator");
    createdModeratorIds.push(unassignedModerator.id); // ingen moderatorCountries-rad her, med hensikt — se testnavnet

    const result = await listModerationQueue(
      makeSession({ userId: unassignedModerator.id, role: "moderator", countryCode: TEST_COUNTRY_CODE })
    );

    expect(result).toEqual([]);
  });
});

// Rydder ALLE moderatorer opprettet av createModerator() (og den ene
// rå-innsatte "unassignedModerator" over) på tvers av HELE filen — se
// createdModeratorIds sin egen kommentar. auditLogs og sessions FØRST:
// publishRequest()/rejectRequest()/requestChanges() logger moderatorens
// handling med actorUserId, og loginAs() setter inn en økt — users.id
// har ingen kaskadesletting (`references()` uten `onDelete`), så en
// gjenværende rad i noen av de to ville gitt et fremmednøkkelbrudd.
afterAll(async () => {
  if (createdModeratorIds.length === 0) return;
  await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, createdModeratorIds));
  await db.delete(sessions).where(inArray(sessions.userId, createdModeratorIds));
  await db.delete(moderatorCountries).where(inArray(moderatorCountries.moderatorUserId, createdModeratorIds));
  await db.delete(users).where(inArray(users.id, createdModeratorIds));
});
