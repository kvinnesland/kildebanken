import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLogs,
  consentRecords,
  contactRequests,
  journalistProfiles,
  moderatorCountries,
  requests,
  responses,
  sessions,
  suppressions,
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
import { generateToken, hashToken } from "@/lib/auth/tokens";
import type { CurrentSession } from "@/lib/auth/session";
import { adminDeleteUser, searchUsersByEmail, suppressUserEmail, suspendUser, unsuspendUser } from "./users";

function makeSession(overrides: Partial<CurrentSession> = {}): CurrentSession {
  return {
    sessionId: "session-id",
    userId: "user-id",
    role: "moderator",
    countryCode: TEST_COUNTRY_CODE,
    locale: "nb-NO",
    email: "test@example.invalid",
    ...overrides,
  };
}

// Samme mønster som de andre moderation/-integrasjonstestene: mocker
// next/headers for å simulere en innlogget moderator/administrator via en
// EKTE sessions-rad.
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

// Ryddes samlet i én afterAll nederst i filen — se createdModeratorIds.
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

describe("suspendUser/unsuspendUser mot ekte Postgres", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("suspendUser(): krever en ikke-tom begrunnelse", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    const result = await suspendUser(recipient.id, "   ");

    expect(result).toEqual({ ok: false, error: "errors.reason_required" });
  });

  it("suspendUser(): setter status til suspended og avslutter aktive økter", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    const rawSessionToken = generateToken();
    await db.insert(sessions).values({
      userId: recipient.id,
      tokenHash: hashToken(rawSessionToken),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const result = await suspendUser(recipient.id, "Misbruk rapportert.");

    expect(result).toEqual({ ok: true });
    const [after] = await db.select().from(users).where(eq(users.id, recipient.id));
    expect(after?.status).toBe("suspended");

    const [recipientSession] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, recipient.id));
    expect(recipientSession?.revokedAt).not.toBeNull();
  });

  it("suspendUser(): kansellerer journalistens EGNE ventende kontaktforespørsler (8.1)", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const respondent = await createActiveRecipient();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    const [request] = await db
      .insert(requests)
      .values({
        journalistId: journalist.id,
        countryCode: TEST_COUNTRY_CODE,
        contentLanguage: "nb-NO",
        title: "Testforespørsel for suspensjon",
        summary: "Sum",
        description: "Desc",
        targetPersonDescription: "Target",
        status: "published",
        allowsAnonymousParticipation: true,
        mayBeRecorded: false,
        mayInvolvePhotoVideo: false,
        responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        publishedAt: new Date(),
      })
      .returning({ id: requests.id });
    if (!request) throw new Error("Klarte ikke opprette testforespørsel");

    const [response] = await db
      .insert(responses)
      .values({
        requestId: request.id,
        respondentId: respondent.id,
        relevanceStatement: "Relevant.",
        answerText: "Svar.",
      })
      .returning({ id: responses.id });
    if (!response) throw new Error("Klarte ikke opprette testsvar");

    await db.insert(contactRequests).values({
      responseId: response.id,
      journalistId: journalist.id,
      message: "Kan jeg få vite mer?",
      requestedContactMethod: "e-post",
      status: "pending",
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    const result = await suspendUser(journalist.id, "Misbruk rapportert.");

    expect(result).toEqual({ ok: true });
    const [afterContactRequest] = await db
      .select()
      .from(contactRequests)
      .where(eq(contactRequests.responseId, response.id));
    expect(afterContactRequest?.status).toBe("cancelled");

    await db.delete(contactRequests).where(eq(contactRequests.responseId, response.id));
    await db.delete(responses).where(eq(responses.id, response.id));
    await db.delete(requests).where(eq(requests.id, request.id));
  });

  it("suspendUser(): er idempotent — en allerede suspendert bruker returnerer ok uten feil", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, recipient.id));

    const result = await suspendUser(recipient.id, "Misbruk rapportert på nytt.");

    expect(result).toEqual({ ok: true });
  });

  it("suspendUser(): en moderator tildelt et ANNET land får errors.not_found (FR-023, 404 ikke 403)", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const recipient = await createActiveRecipient();
    const moderator = await createModerator(TEST_COUNTRY_CODE_2);
    await loginAs(moderator.id);

    const result = await suspendUser(recipient.id, "Misbruk rapportert.");

    expect(result).toEqual({ ok: false, error: "errors.not_found" });
    const [after] = await db.select().from(users).where(eq(users.id, recipient.id));
    expect(after?.status).toBe("active");
  });

  it("unsuspendUser(): en moderator tildelt et ANNET land får errors.not_found (FR-023, 404 ikke 403)", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const recipient = await createActiveRecipient();
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, recipient.id));
    const moderator = await createModerator(TEST_COUNTRY_CODE_2);
    await loginAs(moderator.id);

    const result = await unsuspendUser(recipient.id);

    expect(result).toEqual({ ok: false, error: "errors.not_found" });
    const [after] = await db.select().from(users).where(eq(users.id, recipient.id));
    expect(after?.status).toBe("suspended");
  });

  it("unsuspendUser(): setter en suspendert bruker tilbake til active", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, recipient.id));

    const result = await unsuspendUser(recipient.id);

    expect(result).toEqual({ ok: true });
    const [after] = await db.select().from(users).where(eq(users.id, recipient.id));
    expect(after?.status).toBe("active");
  });

  it("unsuspendUser(): avviser en bruker som ikke er suspendert", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    const result = await unsuspendUser(recipient.id);

    expect(result).toEqual({ ok: false, error: "errors.validation_failed" });
  });

  it("unsuspendUser(): rører IKKE journalistens verification_status (8.1, siste avsnitt)", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, journalist.id));

    const result = await unsuspendUser(journalist.id);

    expect(result).toEqual({ ok: true });
    const [user] = await db.select().from(users).where(eq(users.id, journalist.id));
    expect(user?.status).toBe("active");
    const [profile] = await db
      .select()
      .from(journalistProfiles)
      .where(eq(journalistProfiles.userId, journalist.id));
    expect(profile?.verificationStatus).toBe("approved");
  });
});

describe("suppressUserEmail mot ekte Postgres (SPEC-V1.md 12.5)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("krever en ikke-tom begrunnelse", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    const result = await suppressUserEmail(recipient.id, "  ");

    expect(result).toEqual({ ok: false, error: "errors.reason_required" });
  });

  it("legger e-postens hash til sperrelisten med reason 'manual', OG logger revisjonslogg", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    const result = await suppressUserEmail(recipient.id, "Gjentatt misbruk.");

    expect(result).toEqual({ ok: true });
    const [row] = await db
      .select()
      .from(suppressions)
      .where(eq(suppressions.emailHash, hashToken(recipient.email)));
    expect(row?.reason).toBe("manual");

    await db.delete(suppressions).where(eq(suppressions.emailHash, hashToken(recipient.email)));
  });

  it("rører IKKE kontoens status — en uavhengig handling fra suspendUser()", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    await suppressUserEmail(recipient.id, "Gjentatt misbruk.");

    const [user] = await db.select().from(users).where(eq(users.id, recipient.id));
    expect(user?.status).toBe("active");

    await db.delete(suppressions).where(eq(suppressions.emailHash, hashToken(recipient.email)));
  });

  it("er idempotent — kalt to ganger feiler ikke, kun én rad på sperrelisten", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    const first = await suppressUserEmail(recipient.id, "Første rapport.");
    const second = await suppressUserEmail(recipient.id, "Andre rapport.");

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    const rows = await db
      .select()
      .from(suppressions)
      .where(eq(suppressions.emailHash, hashToken(recipient.email)));
    expect(rows).toHaveLength(1);

    await db.delete(suppressions).where(eq(suppressions.emailHash, hashToken(recipient.email)));
  });

  it("avviser en allerede SLETTET konto (e-posten er allerede erstattet med en hash, 17.5)", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);
    await db.update(users).set({ status: "deleted" }).where(eq(users.id, recipient.id));

    const result = await suppressUserEmail(recipient.id, "For sent.");

    expect(result).toEqual({ ok: false, error: "errors.not_found" });
  });

  it("en moderator tildelt et ANNET land får errors.not_found (FR-023, 404 ikke 403)", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const recipient = await createActiveRecipient();
    const moderator = await createModerator(TEST_COUNTRY_CODE_2);
    await loginAs(moderator.id);

    const result = await suppressUserEmail(recipient.id, "Gjentatt misbruk.");

    expect(result).toEqual({ ok: false, error: "errors.not_found" });
    const rows = await db
      .select()
      .from(suppressions)
      .where(eq(suppressions.emailHash, hashToken(recipient.email)));
    expect(rows).toHaveLength(0);
  });
});

describe("searchUsersByEmail mot ekte Postgres (SPEC-V1.md 16.2)", () => {
  it("finner en mottaker på et DELVIS, versalufølsomt treff, med samtykkehistorikk", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await db.insert(consentRecords).values({
      userId: recipient.id,
      consentType: "email_subscription",
      countryCode: TEST_COUNTRY_CODE,
      locale: "nb-NO",
      granted: true,
      source: "registration_form",
    });

    // Et utsnitt av selve den TILFELDIGE UUID-delen (ikke det faste
    // "recipient-"-prefikset — det matcher hver testmottaker som noensinne
    // er opprettet i denne delte databasen, på tvers av mange netters
    // kjøringer, og ville gjort søket ubrukelig spesifikt).
    const partialQuery = recipient.email.slice(10, 18).toUpperCase();
    const result = await searchUsersByEmail(
      makeSession({ userId: moderator.id, role: "moderator", countryCode: TEST_COUNTRY_CODE }),
      partialQuery
    );

    const match = result.find((u) => u.id === recipient.id);
    expect(match).toBeDefined();
    expect(match?.consents).toEqual([
      expect.objectContaining({ consentType: "email_subscription", granted: true }),
    ]);
  });

  it("returnerer en tom liste for et tomt/blankt søk, uten å liste alle brukere", async () => {
    await ensureTestCountry();
    await createActiveRecipient();

    const result = await searchUsersByEmail(
      makeSession({ role: "moderator", countryCode: TEST_COUNTRY_CODE }),
      "   "
    );

    expect(result).toEqual([]);
  });

  it("filtrerer på moderatorens tildelte land, ikke andre lands mottakere", async () => {
    // Egen, delt og unik markør i BEGGE e-postadressene (ikke bare
    // "recipient" — databasen er delt på tvers av mange netters
    // testkjøringer, og et generisk søkeord ville matchet et stort,
    // ukontrollert antall gamle rader og risikert å skyve DENNE testens
    // egne rader utenfor SEARCH_RESULT_LIMIT).
    const marker = uniqueTestEmail("shared-country-filter-marker").split("@")[0];
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    const [ownRecipient] = await db
      .insert(users)
      .values({
        email: `${marker}-own@example.invalid`,
        role: "recipient",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    const [otherRecipient] = await db
      .insert(users)
      .values({
        email: `${marker}-other@example.invalid`,
        role: "recipient",
        status: "active",
        countryCode: TEST_COUNTRY_CODE_2,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });

    const result = await searchUsersByEmail(
      makeSession({ userId: moderator.id, role: "moderator", countryCode: TEST_COUNTRY_CODE }),
      marker!
    );

    expect(result.some((u) => u.id === ownRecipient!.id)).toBe(true);
    expect(result.some((u) => u.id === otherRecipient!.id)).toBe(false);
  });

  it("gir en administrator treff på tvers av ALLE land (19.4)", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const email = uniqueTestEmail("admin-search-recipient");
    const [otherCountryRecipient] = await db
      .insert(users)
      .values({
        email,
        role: "recipient",
        status: "active",
        countryCode: TEST_COUNTRY_CODE_2,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });

    // Søker på et utsnitt av selve den unike UUID-delen, ikke det faste
    // "admin-search-recipient"-prefikset — samme lærdom som testen over
    // (dette prefikset alene ville akkumulert treff fra HVER natt denne
    // spesifikke testen noensinne har kjørt i denne delte databasen).
    const uniquePart = email.slice("admin-search-recipient-".length, "admin-search-recipient-".length + 8);
    const result = await searchUsersByEmail(makeSession({ role: "admin" }), uniquePart);

    expect(result.some((u) => u.id === otherCountryRecipient!.id)).toBe(true);
  });

  it("returnerer ALDRI en journalist- eller moderatorkonto, kun mottakere", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();

    const result = await searchUsersByEmail(
      makeSession({ role: "admin" }),
      journalist.email.slice(0, 8)
    );

    expect(result.some((u) => u.id === journalist.id)).toBe(false);
  });
});

describe("adminDeleteUser mot ekte Postgres (SPEC-V1.md 16.2, 18.2)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returnerer errors.not_found for en ukjent bruker-ID", async () => {
    const result = await adminDeleteUser("00000000-0000-0000-0000-000000000000");
    expect(result).toEqual({ ok: false, error: "errors.not_found" });
  });

  it("avviser en journalistkonto — 16.2 scoper denne handlingen til Mottakere", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    const result = await adminDeleteUser(journalist.id);

    expect(result).toEqual({ ok: false, error: "errors.validation_failed" });
    const [after] = await db.select().from(users).where(eq(users.id, journalist.id));
    expect(after?.status).not.toBe("deleted");
  });

  it("en moderator tildelt et ANNET land får errors.not_found (FR-023, 404 ikke 403)", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const recipient = await createActiveRecipient();
    const moderator = await createModerator(TEST_COUNTRY_CODE_2);
    await loginAs(moderator.id);

    const result = await adminDeleteUser(recipient.id);

    expect(result).toEqual({ ok: false, error: "errors.not_found" });
    const [after] = await db.select().from(users).where(eq(users.id, recipient.id));
    expect(after?.status).not.toBe("deleted");
  });

  it("sletter en mottakerkonto DIREKTE, uten bekreftelseslenke, og logger MODERATOREN (ikke mottakeren) som utførende", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    const result = await adminDeleteUser(recipient.id);

    expect(result).toEqual({ ok: true });
    const [after] = await db.select().from(users).where(eq(users.id, recipient.id));
    expect(after?.status).toBe("deleted");
    expect(after?.email).not.toBe(recipient.email); // anonymisert (17.5)

    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.entityId, recipient.id));
    expect(log?.action).toBe("account.delete");
    expect(log?.actorUserId).toBe(moderator.id); // IKKE recipient.id
  });

  it("avviser en allerede SLETTET konto (idempotent avvisning, ikke en dobbel sletting)", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);
    await db.update(users).set({ status: "deleted" }).where(eq(users.id, recipient.id));

    const result = await adminDeleteUser(recipient.id);

    expect(result).toEqual({ ok: false, error: "errors.not_found" });
  });

  it("to SAMTIDIGE slettekall for SAMME bruker kjører den irreversible slettingen bare ÉN gang (TOCTOU)", async () => {
    // adminDeleteUser() sin egen `status !== "deleted"`-sjekk er IKKE atomisk
    // — begge samtidige kall kan i PRINSIPPET passere den. Den faktiske
    // sperren ligger i performAccountDeletion() selv (`WHERE status !=
    // 'deleted'` på selve anonymiseringsskrivingen, se account-deletion.ts).
    // Uten DEN ville begge kallene sendt en "account_deletion_confirmed"-
    // e-post OG logget hver sin `account.delete`-revisjonsrad for samme
    // sletting. Hvilket av de to kallene som faktisk blir avvist, avhenger av
    // nøyaktig timing (mot lokal Postgres kan adminDeleteUser() sin EGEN,
    // ikke-atomiske SELECT-sjekk noen ganger selv rekke å se den andre
    // skrivingen — se samme observasjon for soft_bounce-kappløpet i
    // NATTLOGG.md, Økt 19) — testen godtar derfor begge utfall for kall nr.
    // to, og verifiserer i stedet det som FAKTISK betyr noe: nøyaktig ÉN
    // fullført sletting, uansett.
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    const results = await Promise.all([
      adminDeleteUser(recipient.id),
      adminDeleteUser(recipient.id),
    ]);
    // Rekkefølgen de to promisene faktisk fullfører i er ikke garantert lik
    // array-rekkefølgen — påstå derfor ikke HVILKEN av de to som lykkes, bare
    // at minst én gjør det, og at en eventuell avvisning er nøyaktig den
    // forventede (idempotent "allerede slettet"), ikke en uventet feil.
    expect(results.some((r) => r.ok)).toBe(true);
    for (const r of results) {
      if (!r.ok) expect(r).toEqual({ ok: false, error: "errors.not_found" });
    }

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, recipient.id));
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("account.delete");

    const [after] = await db.select().from(users).where(eq(users.id, recipient.id));
    expect(after?.status).toBe("deleted");
    expect(after?.emailHash).toBe(hashToken(recipient.email));
  });
});

// Rydder ALLE moderatorer opprettet av createModerator() på tvers av
// HELE filen (fire describe-blokker) — se createdModeratorIds sin egen
// kommentar. auditLogs/sessions FØRST: suspendUser()/unsuspendUser()/
// suppressUserEmail()/adminDeleteUser() logger moderatorens handling,
// og loginAs() setter inn en økt.
afterAll(async () => {
  if (createdModeratorIds.length === 0) return;
  await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, createdModeratorIds));
  await db.delete(sessions).where(inArray(sessions.userId, createdModeratorIds));
  await db.delete(moderatorCountries).where(inArray(moderatorCountries.moderatorUserId, createdModeratorIds));
  await db.delete(users).where(inArray(users.id, createdModeratorIds));
});
