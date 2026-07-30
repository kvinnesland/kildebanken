import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { journalistProfiles, moderatorCountries, sessions, users } from "@/db/schema";
import {
  ensureSecondTestCountry,
  ensureTestCountry,
  TEST_COUNTRY_CODE,
  TEST_COUNTRY_CODE_2,
  uniqueTestEmail,
} from "@/db/integration/fixtures";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { approveJournalist, rejectJournalist } from "./journalists";

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
