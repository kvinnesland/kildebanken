import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import * as emailSend from "@/lib/email/send";
import { db } from "@/db/client";
import {
  contactRequests,
  countries,
  digestDeliveries,
  digests,
  emailSubscriptions,
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
  uniqueTestEmail,
} from "@/db/integration/fixtures";
import {
  runDeadlineReminders,
  runDigestTick,
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
//
// `runDigestTick` var det ENESTE unntaket — se dens egen docstring i
// tick.ts (økt 7): ikke gatet av `shouldRunDailyJobNow()` i det hele tatt,
// bare aldri eksportert. Dekket nå av egen describe-blokk under, med et
// HELT ISOLERT testland (ikke `TEST_COUNTRY_CODE`) — jobben plukker opp
// ALLE publiserte, ikke-digest-inkluderte forespørsler i et land, så delt
// tilstand med andre parallelle testfiler ville vært skjørt her mer enn
// noe annet sted i denne filen.

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

async function createIsolatedActiveCountry(digestSendTime = "00:00"): Promise<string> {
  const code = `Z${randomUUID().slice(0, 6).toUpperCase()}`;
  await db.insert(countries).values({
    code,
    nameKey: "country.test.name",
    defaultLocale: "nb-NO",
    availableLocales: ["nb-NO", "en-GB"],
    timezone: "Europe/Oslo",
    minimumAge: 18,
    // "00:00" er GARANTERT allerede passert lokal tid, uansett når testen
    // faktisk kjører — nødvendig for at digest-tickens egen
    // klokkeslett-vakt (`localTimeHHMM < country.digestSendTime`) slipper
    // gjennom uten å måtte fryse/mocke systemklokken.
    digestSendTime,
    senderNameKey: "email.sender_name.test",
    supportEmail: "test@example.invalid",
    status: "active",
  });
  return code;
}

async function createIsolatedJournalist(countryCode: string): Promise<{ id: string }> {
  const [user] = await db
    .insert(users)
    .values({
      email: uniqueTestEmail("digest-journalist"),
      role: "journalist",
      status: "active",
      countryCode,
      locale: "nb-NO",
      emailVerifiedAt: new Date(),
    })
    .returning({ id: users.id });
  if (!user) throw new Error("Klarte ikke opprette test-journalist");
  await db.insert(journalistProfiles).values({
    userId: user.id,
    fullName: "Test Journalist",
    jobTitle: "Journalist",
    organizationName: "Testavisen",
    organizationUrl: "https://example.invalid",
    verificationStatus: "approved",
  });
  return user;
}

async function createIsolatedRecipient(
  countryCode: string,
  locale = "nb-NO",
  subscriptionStatus: "active" | "unsubscribed" | "bounced" = "active"
): Promise<{ id: string; email: string }> {
  const email = uniqueTestEmail("digest-recipient");
  const [user] = await db
    .insert(users)
    .values({
      email,
      role: "recipient",
      status: "active",
      countryCode,
      locale,
      emailVerifiedAt: new Date(),
    })
    .returning({ id: users.id });
  if (!user) throw new Error("Klarte ikke opprette test-mottaker");
  await db.insert(emailSubscriptions).values({
    userId: user.id,
    status: subscriptionStatus,
    unsubscribeTokenHash: randomUUID(),
  });
  return { id: user.id, email };
}

async function createPublishedRequestForDigest(
  journalistId: string,
  countryCode: string,
  contentLanguage = "nb-NO"
) {
  const [request] = await db
    .insert(requests)
    .values({
      journalistId,
      countryCode,
      contentLanguage,
      title: "Testforespørsel for digest",
      summary: "Sammendrag.",
      description: "Beskrivelse.",
      targetPersonDescription: "Hvem som helst.",
      slug: `test-digest-${randomUUID()}`,
      status: "published",
      allowsAnonymousParticipation: true,
      mayBeRecorded: false,
      mayInvolvePhotoVideo: false,
      responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      publishedAt: new Date(),
    })
    .returning();
  if (!request) throw new Error("Klarte ikke opprette testforespørsel");
  return request;
}

async function cleanupCountry(code: string): Promise<void> {
  const digestIdsForCountry = db.select({ id: digests.id }).from(digests).where(eq(digests.countryCode, code));
  const userIdsForCountry = db.select({ id: users.id }).from(users).where(eq(users.countryCode, code));

  await db.delete(digestDeliveries).where(inArray(digestDeliveries.digestId, digestIdsForCountry));
  await db.delete(digests).where(eq(digests.countryCode, code));
  await db.delete(requests).where(eq(requests.countryCode, code));
  await db.delete(journalistProfiles).where(inArray(journalistProfiles.userId, userIdsForCountry));
  await db.delete(emailSubscriptions).where(inArray(emailSubscriptions.userId, userIdsForCountry));
  await db.delete(users).where(eq(users.countryCode, code));
  await db.delete(countries).where(eq(countries.code, code));
}

describe("runDigestTick mot ekte Postgres (FR-030 til FR-038, SPEC-V1.md 10, 23 punkt 4)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("oppretter en digest og sender til en aktiv mottaker, ruller avmeldingstoken, og setter included_in_digest_at", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const code = await createIsolatedActiveCountry();
    try {
      const journalist = await createIsolatedJournalist(code);
      const request = await createPublishedRequestForDigest(journalist.id, code);
      const recipient = await createIsolatedRecipient(code);
      const [subscriptionBefore] = await db
        .select()
        .from(emailSubscriptions)
        .where(eq(emailSubscriptions.userId, recipient.id));

      const result = await runDigestTick(db);

      expect(result.job).toBe("digest-tick");
      expect(result.errors).toEqual([]);

      const [digestRow] = await db.select().from(digests).where(eq(digests.countryCode, code));
      expect(digestRow?.status).toBe("sent");
      expect(digestRow?.recipientCount).toBe(1);
      expect(digestRow?.requestIds).toEqual([request.id]);

      const [deliveryRow] = await db
        .select()
        .from(digestDeliveries)
        .where(eq(digestDeliveries.userId, recipient.id));
      expect(deliveryRow?.status).toBe("sent");
      expect(deliveryRow?.locale).toBe("nb-NO");

      const [requestAfter] = await db.select().from(requests).where(eq(requests.id, request.id));
      expect(requestAfter?.includedInDigestAt).not.toBeNull();

      const [subscriptionAfter] = await db
        .select()
        .from(emailSubscriptions)
        .where(eq(emailSubscriptions.userId, recipient.id));
      expect(subscriptionAfter?.unsubscribeTokenHash).not.toBe(subscriptionBefore?.unsubscribeTokenHash);
      expect(subscriptionAfter?.lastDigestAt).not.toBeNull();

      expect(warnSpy.mock.calls.some((call) => String(call[0]).includes("[email:stub:bulk]"))).toBe(
        true
      );
    } finally {
      await cleanupCountry(code);
    }
  });

  it("FR-034: er idempotent — et andre tikk samme dag oppretter IKKE en ny digest", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const code = await createIsolatedActiveCountry();
    try {
      const journalist = await createIsolatedJournalist(code);
      await createPublishedRequestForDigest(journalist.id, code);
      await createIsolatedRecipient(code);

      await runDigestTick(db);
      const secondResult = await runDigestTick(db);

      expect(secondResult.processed).toBe(0);
      const allDigests = await db.select().from(digests).where(eq(digests.countryCode, code));
      expect(allDigests).toHaveLength(1);
    } finally {
      await cleanupCountry(code);
    }
  });

  it("FR-031: sender IKKE til en mottaker i et ANNET land", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const code = await createIsolatedActiveCountry();
    const otherCode = await createIsolatedActiveCountry();
    try {
      const journalist = await createIsolatedJournalist(code);
      await createPublishedRequestForDigest(journalist.id, code);
      await createIsolatedRecipient(code);
      const otherCountryRecipient = await createIsolatedRecipient(otherCode);

      await runDigestTick(db);

      const [digestRow] = await db.select().from(digests).where(eq(digests.countryCode, code));
      const otherDelivery = await db
        .select()
        .from(digestDeliveries)
        .where(eq(digestDeliveries.userId, otherCountryRecipient.id));
      expect(otherDelivery).toHaveLength(0);
      expect(digestRow?.recipientCount).toBe(1);
    } finally {
      await cleanupCountry(code);
      await cleanupCountry(otherCode);
    }
  });

  it("FR-035: utelater en mottaker med avmeldt eller sprettet abonnement", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const code = await createIsolatedActiveCountry();
    try {
      const journalist = await createIsolatedJournalist(code);
      await createPublishedRequestForDigest(journalist.id, code);
      const activeRecipient = await createIsolatedRecipient(code, "nb-NO", "active");
      const unsubscribedRecipient = await createIsolatedRecipient(code, "nb-NO", "unsubscribed");
      const bouncedRecipient = await createIsolatedRecipient(code, "nb-NO", "bounced");

      const result = await runDigestTick(db);

      expect(result.errors).toEqual([]);
      const [digestRow] = await db.select().from(digests).where(eq(digests.countryCode, code));
      expect(digestRow?.recipientCount).toBe(1);
      const activeDelivery = await db
        .select()
        .from(digestDeliveries)
        .where(eq(digestDeliveries.userId, activeRecipient.id));
      expect(activeDelivery).toHaveLength(1);
      const unsubscribedDelivery = await db
        .select()
        .from(digestDeliveries)
        .where(eq(digestDeliveries.userId, unsubscribedRecipient.id));
      expect(unsubscribedDelivery).toHaveLength(0);
      const bouncedDelivery = await db
        .select()
        .from(digestDeliveries)
        .where(eq(digestDeliveries.userId, bouncedRecipient.id));
      expect(bouncedDelivery).toHaveLength(0);
    } finally {
      await cleanupCountry(code);
    }
  });

  it("FR-032/FR-033: rendrer én variant per locale FAKTISK i bruk, og logger riktig locale per levering", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const code = await createIsolatedActiveCountry();
    try {
      const journalist = await createIsolatedJournalist(code);
      await createPublishedRequestForDigest(journalist.id, code);
      const norwegianRecipient = await createIsolatedRecipient(code, "nb-NO");
      const englishRecipient = await createIsolatedRecipient(code, "en-GB");

      await runDigestTick(db);

      const [nbDelivery] = await db
        .select()
        .from(digestDeliveries)
        .where(eq(digestDeliveries.userId, norwegianRecipient.id));
      const [enDelivery] = await db
        .select()
        .from(digestDeliveries)
        .where(eq(digestDeliveries.userId, englishRecipient.id));
      expect(nbDelivery?.locale).toBe("nb-NO");
      expect(enDelivery?.locale).toBe("en-GB");
    } finally {
      await cleanupCountry(code);
    }
  });

  it("SPEC-V1.md 23 punkt 19: en-GB-mottaker i et nb-NO-land får ENGELSK ramme med et fremmedspråk-varsel, siden forespørselsteksten er norsk", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const sendBulkEmailSpy = vi.spyOn(emailSend, "sendBulkEmail");
    const code = await createIsolatedActiveCountry();
    try {
      const journalist = await createIsolatedJournalist(code);
      // contentLanguage "nb-NO" (landets standard) — se createPublishedRequestForDigest.
      await createPublishedRequestForDigest(journalist.id, code);
      const norwegianRecipient = await createIsolatedRecipient(code, "nb-NO");
      const englishRecipient = await createIsolatedRecipient(code, "en-GB");

      await runDigestTick(db);

      const nbCall = sendBulkEmailSpy.mock.calls.find((call) => call[0].to.email === norwegianRecipient.email);
      const enCall = sendBulkEmailSpy.mock.calls.find((call) => call[0].to.email === englishRecipient.email);
      // Ramme OG varsel er begge på MOTTAKERENS locale, ikke landets — den
      // norske mottakeren ser ingen varsel (samsvarende språk), den engelske
      // ser varselet på ENGELSK (ikke norsk), fordi selve rammen er engelsk.
      expect(nbCall?.[0].html).not.toContain("is written in a different language");
      expect(enCall?.[0].html).toContain("This request is written in a different language than yours.");
      // "engelsk ramme" (23, punkt 19) — selve emnefeltet er på mottakerens locale.
      expect(enCall?.[0].subject).not.toBe(nbCall?.[0].subject);
    } finally {
      await cleanupCountry(code);
    }
  });

  it("FR-036/SPEC-V1.md 23 punkt 20: en simulert leverandørfeil i ett land påvirker IKKE et annet land i samme tikk", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const realSendBulkEmail = emailSend.sendBulkEmail;
    const codeA = await createIsolatedActiveCountry();
    const codeB = await createIsolatedActiveCountry();
    try {
      const journalistA = await createIsolatedJournalist(codeA);
      await createPublishedRequestForDigest(journalistA.id, codeA);
      const recipientA = await createIsolatedRecipient(codeA);

      const journalistB = await createIsolatedJournalist(codeB);
      await createPublishedRequestForDigest(journalistB.id, codeB);
      const recipientB = await createIsolatedRecipient(codeB);

      // Simulerer at KUN land A sin mottaker feiler mot "leverandøren" —
      // land B sin ekte (stub-)utsendelse kjører helt uendret.
      vi.spyOn(emailSend, "sendBulkEmail").mockImplementation(async (input) => {
        if (input.to.email === recipientA.email) {
          throw new Error("Simulert leverandørfeil for land A.");
        }
        return realSendBulkEmail(input);
      });

      const result = await runDigestTick(db);

      // Landet som feilet stopper IKKE det andre landets behandling i
      // SAMME tikk (FR-036) — begge er "processed" (digest opprettet), selv
      // om land A sin ble merket "failed" internt.
      expect(result.processed).toBe(2);

      const [digestA] = await db.select().from(digests).where(eq(digests.countryCode, codeA));
      const [digestB] = await db.select().from(digests).where(eq(digests.countryCode, codeB));
      expect(digestA?.status).toBe("failed");
      expect(digestB?.status).toBe("sent");

      const [deliveryA] = await db
        .select()
        .from(digestDeliveries)
        .where(eq(digestDeliveries.userId, recipientA.id));
      const [deliveryB] = await db
        .select()
        .from(digestDeliveries)
        .where(eq(digestDeliveries.userId, recipientB.id));
      expect(deliveryA?.status).toBe("failed");
      expect(deliveryA?.errorMessage).toContain("Simulert leverandørfeil");
      expect(deliveryB?.status).toBe("sent");
    } finally {
      await cleanupCountry(codeA);
      await cleanupCountry(codeB);
    }
  });

  it("sender IKKE en tom digest når landet ikke har noen nye publiserte forespørsler", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const code = await createIsolatedActiveCountry();
    try {
      await createIsolatedRecipient(code);
      // Ingen forespørsel opprettet i det hele tatt.

      const result = await runDigestTick(db);

      expect(result.processed).toBe(0);
      const allDigests = await db.select().from(digests).where(eq(digests.countryCode, code));
      expect(allDigests).toHaveLength(0);
    } finally {
      await cleanupCountry(code);
    }
  });

  it("8.1: utelater en forespørsel fra en SUSPENDERT journalist fra en ny digest", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const code = await createIsolatedActiveCountry();
    try {
      const journalist = await createIsolatedJournalist(code);
      await createPublishedRequestForDigest(journalist.id, code);
      await createIsolatedRecipient(code);
      await db.update(users).set({ status: "suspended" }).where(eq(users.id, journalist.id));

      const result = await runDigestTick(db);

      expect(result.processed).toBe(0);
      const allDigests = await db.select().from(digests).where(eq(digests.countryCode, code));
      expect(allDigests).toHaveLength(0);
    } finally {
      await cleanupCountry(code);
    }
  });
});
