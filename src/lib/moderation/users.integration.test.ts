import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  contactRequests,
  journalistProfiles,
  moderatorCountries,
  requests,
  responses,
  sessions,
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
import { suspendUser, unsuspendUser } from "./users";

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

  it("suspendUser(): en moderator tildelt et ANNET land nektes (SPEC-V1.md 4)", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const recipient = await createActiveRecipient();
    const moderator = await createModerator(TEST_COUNTRY_CODE_2);
    await loginAs(moderator.id);

    const result = await suspendUser(recipient.id, "Misbruk rapportert.");

    expect(result).toEqual({ ok: false, error: "errors.not_authorized" });
    const [after] = await db.select().from(users).where(eq(users.id, recipient.id));
    expect(after?.status).toBe("active");
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
