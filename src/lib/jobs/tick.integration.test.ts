import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contactRequests, requests, responses, users } from "@/db/schema";
import {
  createActiveJournalist,
  createActiveRecipient,
  ensureTestCountry,
  TEST_COUNTRY_CODE,
  uniqueTestEmail,
} from "@/db/integration/fixtures";
import {
  runDeadlineReminders,
  runExpireContactRequests,
  runExpireRequests,
  runPurgeUnverified,
  runStaleRequestReminders,
} from "./tick";

// Ren, database-parametrisert jobblogikk — INGEN sesjon/cookie-avhengighet
// (i motsetning til f.eks. moderation/requests.ts), så disse kan
// integrasjonstestes direkte uten å mocke `next/headers`. Manglet frem til
// nå fordi funksjonene ikke var eksportert (kun `runTick()`, som er
// upraktisk å teste direkte pga. `shouldRunDailyJobNow()`s vegg-klokke-
// avhengighet) — laveste-risiko-skiven av den lenge utsatte
// testbarhets-refaktoreringen, se NATTLOGG.md.

async function insertRequest(
  journalistId: string,
  overrides: Partial<typeof requests.$inferInsert> = {}
) {
  const [row] = await db
    .insert(requests)
    .values({
      journalistId,
      countryCode: TEST_COUNTRY_CODE,
      contentLanguage: "nb-NO",
      title: "Testforespørsel for tick.ts",
      summary: "Sammendrag.",
      description: "Beskrivelse.",
      targetPersonDescription: "Hvem som helst.",
      status: "published",
      allowsAnonymousParticipation: true,
      mayBeRecorded: false,
      mayInvolvePhotoVideo: false,
      responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      publishedAt: new Date(),
      ...overrides,
    })
    .returning();
  if (!row) throw new Error("Klarte ikke opprette testforespørsel");
  return row;
}

describe("runExpireRequests mot ekte Postgres (FR-026)", () => {
  afterEach(async () => {
    await db.delete(requests).where(eq(requests.title, "Testforespørsel for tick.ts"));
  });

  it("setter en publisert forespørsel med utløpt frist til expired, og setter closedAt", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const expired = await insertRequest(journalist.id, {
      responseDeadline: new Date(Date.now() - 60 * 60 * 1000),
    });

    const result = await runExpireRequests(db);

    const [after] = await db.select().from(requests).where(eq(requests.id, expired.id));
    expect(after?.status).toBe("expired");
    expect(after?.closedAt).not.toBeNull();
    expect(result.processed).toBeGreaterThanOrEqual(1);
  });

  it("lar en publisert forespørsel med fremtidig frist stå uendret", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const notYetDue = await insertRequest(journalist.id, {
      responseDeadline: new Date(Date.now() + 60 * 60 * 1000),
    });

    await runExpireRequests(db);

    const [after] = await db.select().from(requests).where(eq(requests.id, notYetDue.id));
    expect(after?.status).toBe("published");
    expect(after?.closedAt).toBeNull();
  });
});

describe("runExpireContactRequests mot ekte Postgres (FR-046)", () => {
  // Rydder i AVHENGIGHETSREKKEFØLGE (contact_requests → responses →
  // requests) — ingen ON DELETE CASCADE er satt på disse fremmednøklene
  // (bevisst, se schema.ts), så en sletting av forespørselen først ville
  // feilet på en fremmednøkkel-konflikt så lenge svaret fortsatt refererer
  // til den.
  let createdRequestIds: string[] = [];

  afterEach(async () => {
    for (const requestId of createdRequestIds) {
      const responseRows = await db
        .select({ id: responses.id })
        .from(responses)
        .where(eq(responses.requestId, requestId));
      for (const r of responseRows) {
        await db.delete(contactRequests).where(eq(contactRequests.responseId, r.id));
      }
      await db.delete(responses).where(eq(responses.requestId, requestId));
      await db.delete(requests).where(eq(requests.id, requestId));
    }
    createdRequestIds = [];
  });

  it("setter en 15 dager gammel, ventende kontaktforespørsel til expired", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const respondent = await createActiveRecipient();
    const request = await insertRequest(journalist.id);
    createdRequestIds.push(request.id);
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

    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const [contactRequest] = await db
      .insert(contactRequests)
      .values({
        responseId: response.id,
        journalistId: journalist.id,
        message: "Kan jeg få vite mer?",
        requestedContactMethod: "e-post",
        status: "pending",
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        createdAt: fifteenDaysAgo,
      })
      .returning({ id: contactRequests.id });
    if (!contactRequest) throw new Error("Klarte ikke opprette testkontaktforespørsel");

    const result = await runExpireContactRequests(db);

    const [after] = await db
      .select()
      .from(contactRequests)
      .where(eq(contactRequests.id, contactRequest.id));
    expect(after?.status).toBe("expired");
    expect(result.processed).toBeGreaterThanOrEqual(1);
  });

  it("lar en ny, ventende kontaktforespørsel stå uendret", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const respondent = await createActiveRecipient();
    const request = await insertRequest(journalist.id);
    createdRequestIds.push(request.id);
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

    const [contactRequest] = await db
      .insert(contactRequests)
      .values({
        responseId: response.id,
        journalistId: journalist.id,
        message: "Kan jeg få vite mer?",
        requestedContactMethod: "e-post",
        status: "pending",
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      })
      .returning({ id: contactRequests.id });
    if (!contactRequest) throw new Error("Klarte ikke opprette testkontaktforespørsel");

    await runExpireContactRequests(db);

    const [after] = await db
      .select()
      .from(contactRequests)
      .where(eq(contactRequests.id, contactRequest.id));
    expect(after?.status).toBe("pending");
  });
});

describe("runDeadlineReminders mot ekte Postgres", () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await db.delete(requests).where(eq(requests.title, "Testforespørsel for tick.ts"));
  });

  it("sender påminnelse for en forespørsel med frist innen 24t, og setter deadlineReminderSentAt", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const dueSoon = await insertRequest(journalist.id, {
      responseDeadline: new Date(Date.now() + 60 * 60 * 1000),
    });

    const result = await runDeadlineReminders(db);

    expect(result.processed).toBeGreaterThanOrEqual(1);
    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes("deadline_approaching_24h"))).toBe(
      true
    );
    const [after] = await db.select().from(requests).where(eq(requests.id, dueSoon.id));
    expect(after?.deadlineReminderSentAt).not.toBeNull();
  });

  it("er idempotent — sender IKKE på nytt når deadlineReminderSentAt allerede er satt", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    await insertRequest(journalist.id, {
      responseDeadline: new Date(Date.now() + 60 * 60 * 1000),
      deadlineReminderSentAt: new Date(),
    });

    await runDeadlineReminders(db);

    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes("deadline_approaching_24h"))).toBe(
      false
    );
  });

  it("lar en forespørsel med frist langt frem i tid stå uten påminnelse", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    await insertRequest(journalist.id, {
      responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    await runDeadlineReminders(db);

    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes("deadline_approaching_24h"))).toBe(
      false
    );
  });
});

describe("runStaleRequestReminders mot ekte Postgres (SPEC-V1.md 9.2)", () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await db.delete(requests).where(eq(requests.title, "Testforespørsel for tick.ts"));
  });

  it("sender påminnelse for en forespørsel publisert for over 30 dager siden, og setter staleReminderSentAt", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const stale = await insertRequest(journalist.id, {
      publishedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    });

    const result = await runStaleRequestReminders(db);

    expect(result.processed).toBeGreaterThanOrEqual(1);
    expect(
      warnSpy.mock.calls.some((call) => String(call[0]).includes("stale_request_reminder_30d"))
    ).toBe(true);
    const [after] = await db.select().from(requests).where(eq(requests.id, stale.id));
    expect(after?.staleReminderSentAt).not.toBeNull();
  });

  it("er idempotent — sender IKKE på nytt når staleReminderSentAt allerede er satt", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    await insertRequest(journalist.id, {
      publishedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      staleReminderSentAt: new Date(),
    });

    await runStaleRequestReminders(db);

    expect(
      warnSpy.mock.calls.some((call) => String(call[0]).includes("stale_request_reminder_30d"))
    ).toBe(false);
  });

  it("lar en nylig publisert forespørsel stå uten påminnelse", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    await insertRequest(journalist.id, { publishedAt: new Date() });

    await runStaleRequestReminders(db);

    expect(
      warnSpy.mock.calls.some((call) => String(call[0]).includes("stale_request_reminder_30d"))
    ).toBe(false);
  });
});

describe("runPurgeUnverified mot ekte Postgres (FR-004)", () => {
  it("sletter en ubekreftet konto eldre enn 14 dager", async () => {
    const email = uniqueTestEmail("purge-old");
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const [user] = await db
      .insert(users)
      .values({
        email,
        role: "recipient",
        status: "pending_email_verification",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        createdAt: fifteenDaysAgo,
      })
      .returning({ id: users.id });
    if (!user) throw new Error("Klarte ikke opprette testbruker");
    await ensureTestCountry();

    const result = await runPurgeUnverified(db);

    const [after] = await db.select().from(users).where(eq(users.id, user.id));
    expect(after).toBeUndefined();
    expect(result.processed).toBeGreaterThanOrEqual(1);
  });

  it("lar en fersk, ubekreftet konto stå uslettet", async () => {
    await ensureTestCountry();
    const email = uniqueTestEmail("purge-fresh");
    const [user] = await db
      .insert(users)
      .values({
        email,
        role: "recipient",
        status: "pending_email_verification",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
      })
      .returning({ id: users.id });
    if (!user) throw new Error("Klarte ikke opprette testbruker");

    await runPurgeUnverified(db);

    const [after] = await db.select().from(users).where(eq(users.id, user.id));
    expect(after).toBeDefined();

    await db.delete(users).where(eq(users.id, user.id));
  });

  it("lar en AKTIV (bekreftet) konto stå uslettet, selv om den er eldre enn 14 dager", async () => {
    await ensureTestCountry();
    const email = uniqueTestEmail("purge-verified-old");
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const [user] = await db
      .insert(users)
      .values({
        email,
        role: "recipient",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: fifteenDaysAgo,
        createdAt: fifteenDaysAgo,
      })
      .returning({ id: users.id });
    if (!user) throw new Error("Klarte ikke opprette testbruker");

    await runPurgeUnverified(db);

    const [after] = await db.select().from(users).where(eq(users.id, user.id));
    expect(after).toBeDefined();

    await db.delete(users).where(eq(users.id, user.id));
  });
});
