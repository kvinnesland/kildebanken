import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, journalistProfiles, moderatorCountries, requests, sessions, users } from "@/db/schema";
import {
  ensureSecondTestCountry,
  ensureTestCountry,
  TEST_COUNTRY_CODE,
  TEST_COUNTRY_CODE_2,
  uniqueTestEmail,
} from "@/db/integration/fixtures";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import type { CurrentSession } from "@/lib/auth/session";
import { approveJournalist, listJournalists, rejectJournalist } from "./journalists";

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

// Samme mønster som moderation/requests.integration.test.ts: mocker
// next/headers for å simulere en innlogget bruker via en EKTE
// sessions-rad, siden approveJournalist()/rejectJournalist() kaller
// requireModeratorForCountry() → getCurrentSession() internt.
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

async function createPendingJournalist(countryCode: string): Promise<{ id: string; email: string }> {
  const email = uniqueTestEmail("pending-journalist");
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

  await db.insert(journalistProfiles).values({
    userId: user.id,
    fullName: "Ventende Journalist",
    jobTitle: "Journalist",
    organizationName: "Testavisen",
    organizationUrl: "https://example.invalid",
    verificationStatus: "pending_review",
  });

  return { id: user.id, email };
}

describe("approveJournalist/rejectJournalist mot ekte Postgres", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("approveJournalist(): en moderator tildelt SAMME land kan godkjenne", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const journalist = await createPendingJournalist(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    const result = await approveJournalist(journalist.id);

    expect(result).toEqual({ ok: true });
    const [profile] = await db
      .select()
      .from(journalistProfiles)
      .where(eq(journalistProfiles.userId, journalist.id));
    expect(profile?.verificationStatus).toBe("approved");
    expect(profile?.reviewedBy).toBe(moderator.id);
    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes("journalist_approved"))).toBe(
      true
    );
  });

  it("approveJournalist(): en moderator tildelt et ANNET land nektes (SPEC-V1.md 4)", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const journalist = await createPendingJournalist(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE_2);
    await loginAs(moderator.id);

    const result = await approveJournalist(journalist.id);

    expect(result).toEqual({ ok: false, error: "errors.not_authorized" });
    const [profile] = await db
      .select()
      .from(journalistProfiles)
      .where(eq(journalistProfiles.userId, journalist.id));
    expect(profile?.verificationStatus).toBe("pending_review");
  });

  it("rejectJournalist(): krever en ikke-tom begrunnelse", async () => {
    await ensureTestCountry();
    const journalist = await createPendingJournalist(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    const result = await rejectJournalist(journalist.id, "  ");

    expect(result).toEqual({ ok: false, error: "errors.reason_required" });
  });

  it("rejectJournalist(): avviser med begrunnelse, satt inn i teksten uoversatt, og varsler søkeren", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const journalist = await createPendingJournalist(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    const result = await rejectJournalist(journalist.id, "Kunne ikke bekrefte redaksjonstilknytning.");

    expect(result).toEqual({ ok: true });
    const [profile] = await db
      .select()
      .from(journalistProfiles)
      .where(eq(journalistProfiles.userId, journalist.id));
    expect(profile?.verificationStatus).toBe("rejected");
    expect(profile?.reviewNote).toBe("Kunne ikke bekrefte redaksjonstilknytning.");
    const loggedMessage = warnSpy.mock.calls.find((call) =>
      String(call[0]).includes("journalist_rejected")
    );
    expect(loggedMessage?.[0]).toContain("journalist_rejected");
  });

  it("en administrator kan godkjenne UANSETT land (19.4)", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const journalist = await createPendingJournalist(TEST_COUNTRY_CODE);

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
    await loginAs(admin.id);

    const result = await approveJournalist(journalist.id);

    expect(result).toEqual({ ok: true });
  });

  it("approveJournalist(): avviser en søknad som allerede er GODKJENT (8.1: verification_status er endelig)", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const journalist = await createPendingJournalist(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);
    const first = await approveJournalist(journalist.id);
    expect(first).toEqual({ ok: true });

    const second = await approveJournalist(journalist.id);

    expect(second).toEqual({ ok: false, error: "errors.journalist_not_pending_review" });
  });

  it("rejectJournalist(): avviser en søknad som allerede er AVVIST — kan ikke flippes frem og tilbake", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const journalist = await createPendingJournalist(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);
    const first = await rejectJournalist(journalist.id, "Første begrunnelse.");
    expect(first).toEqual({ ok: true });

    const second = await approveJournalist(journalist.id);

    expect(second).toEqual({ ok: false, error: "errors.journalist_not_pending_review" });
    const [profile] = await db
      .select()
      .from(journalistProfiles)
      .where(eq(journalistProfiles.userId, journalist.id));
    expect(profile?.verificationStatus).toBe("rejected");
  });
});

describe("listJournalists mot ekte Postgres (SPEC-V1.md 16.2)", () => {
  it("returnerer ALLE statuser når ingen statusFilter er gitt, med status og pastRequestCount", async () => {
    await ensureTestCountry();
    const journalist = await createPendingJournalist(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await db.insert(requests).values([
      { journalistId: journalist.id, countryCode: TEST_COUNTRY_CODE, contentLanguage: "nb-NO", status: "published" },
      { journalistId: journalist.id, countryCode: TEST_COUNTRY_CODE, contentLanguage: "nb-NO", status: "closed" },
      // Utkast og en før-publisering-slettet rad skal IKKE telles med.
      { journalistId: journalist.id, countryCode: TEST_COUNTRY_CODE, contentLanguage: "nb-NO", status: "draft" },
      { journalistId: journalist.id, countryCode: TEST_COUNTRY_CODE, contentLanguage: "nb-NO", status: "deleted" },
    ]);

    const result = await listJournalists(
      makeSession({ userId: moderator.id, role: "moderator", countryCode: TEST_COUNTRY_CODE })
    );

    const match = result.find((j) => j.userId === journalist.id);
    expect(match).toMatchObject({
      status: "active",
      verificationStatus: "pending_review",
      pastRequestCount: 2,
    });
  });

  it("emailQuery: delvis, versalufølsomt treff — inkluderer treffet og EKSKLUDERER en annen journalist", async () => {
    await ensureTestCountry();
    const target = await createPendingJournalist(TEST_COUNTRY_CODE);
    const other = await createPendingJournalist(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE);

    // Utsnitt av den tilfeldige UUID-delen, ikke det faste
    // "pending-journalist-"-prefikset — se NATTLOGG.md (samme lærdom som
    // moderation/users.integration.test.ts sin searchUsersByEmail()-test:
    // et generisk prefiks ville matchet rader fra mange tidligere netters
    // kjøringer i denne delte, aldri nullstilte databasen).
    const uniquePart = target.email.slice(19, 27).toUpperCase();
    const result = await listJournalists(
      makeSession({ userId: moderator.id, role: "moderator", countryCode: TEST_COUNTRY_CODE }),
      undefined,
      uniquePart
    );

    expect(result.some((j) => j.userId === target.id)).toBe(true);
    expect(result.some((j) => j.userId === other.id)).toBe(false);
  });

  it("statusFilter og emailQuery kombineres (OG, ikke ELLER)", async () => {
    await ensureTestCountry();
    const pending = await createPendingJournalist(TEST_COUNTRY_CODE);
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    const uniquePart = pending.email.slice(19, 27);

    const withWrongStatusFilter = await listJournalists(
      makeSession({ userId: moderator.id, role: "moderator", countryCode: TEST_COUNTRY_CODE }),
      "approved",
      uniquePart
    );
    // Fortsatt "pending_review" — statusFilter "approved" skal IKKE gi
    // treff, selv om e-postsøket alene ville matchet.
    expect(withWrongStatusFilter.some((j) => j.userId === pending.id)).toBe(false);

    const withMatchingStatusFilter = await listJournalists(
      makeSession({ userId: moderator.id, role: "moderator", countryCode: TEST_COUNTRY_CODE }),
      "pending_review",
      uniquePart
    );
    expect(withMatchingStatusFilter.some((j) => j.userId === pending.id)).toBe(true);
  });

  it("filtrerer på moderatorens tildelte land, ikke andre lands journalister", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const ownJournalist = await createPendingJournalist(TEST_COUNTRY_CODE);
    const otherJournalist = await createPendingJournalist(TEST_COUNTRY_CODE_2);
    const moderator = await createModerator(TEST_COUNTRY_CODE);

    const result = await listJournalists(
      makeSession({ userId: moderator.id, role: "moderator", countryCode: TEST_COUNTRY_CODE })
    );

    expect(result.some((j) => j.userId === ownJournalist.id)).toBe(true);
    expect(result.some((j) => j.userId === otherJournalist.id)).toBe(false);
  });

  it("gir en administrator ALLE lands journalister (19.4)", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const otherJournalist = await createPendingJournalist(TEST_COUNTRY_CODE_2);

    const result = await listJournalists(makeSession({ role: "admin" }));

    expect(result.some((j) => j.userId === otherJournalist.id)).toBe(true);
  });

  it("returnerer en tom liste for en moderator uten tildelte land", async () => {
    await ensureTestCountry();
    const [unassignedModerator] = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("unassigned-moderator"),
        role: "moderator",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    if (unassignedModerator) createdModeratorIds.push(unassignedModerator.id);

    const result = await listJournalists(
      makeSession({ userId: unassignedModerator!.id, role: "moderator", countryCode: TEST_COUNTRY_CODE })
    );

    expect(result).toEqual([]);
  });
});

// Rydder ALLE moderatorer opprettet av createModerator() på tvers av
// HELE filen (to describe-blokker) — se createdModeratorIds sin egen
// kommentar. journalist_profiles.reviewed_by nulles FØRST:
// approveJournalist()/rejectJournalist() setter reviewedBy = moderatorens
// id, og den kolonnen har ingen kaskadesletting. auditLogs/sessions
// deretter, av samme grunn.
afterAll(async () => {
  if (createdModeratorIds.length === 0) return;
  await db
    .update(journalistProfiles)
    .set({ reviewedBy: null })
    .where(inArray(journalistProfiles.reviewedBy, createdModeratorIds));
  await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, createdModeratorIds));
  await db.delete(sessions).where(inArray(sessions.userId, createdModeratorIds));
  await db.delete(moderatorCountries).where(inArray(moderatorCountries.moderatorUserId, createdModeratorIds));
  await db.delete(users).where(inArray(users.id, createdModeratorIds));
});
