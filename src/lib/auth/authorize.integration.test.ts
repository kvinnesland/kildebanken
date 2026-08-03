import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { moderatorCountries, sessions, users } from "@/db/schema";
import {
  ensureSecondTestCountry,
  ensureTestCountry,
  TEST_COUNTRY_CODE,
  TEST_COUNTRY_CODE_2,
  uniqueTestEmail,
} from "@/db/integration/fixtures";
import { generateToken, hashToken } from "@/lib/auth/tokens";

// requireModeratorForCountry()/requireAdmin()/getAssignedCountryCodes() kaller
// getCurrentSession() internt (en next/headers-cookie) — samme mocking-mønster
// som moderation/requests.integration.test.ts.
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
const createdAdminIds: string[] = [];

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

async function createAdmin(): Promise<{ id: string }> {
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
  createdAdminIds.push(admin.id);
  return admin;
}

describe("requireModeratorForCountry mot ekte Postgres (SPEC-V1.md 4/19.4)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returnerer null når ingen økt finnes", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    const { requireModeratorForCountry } = await import("./authorize");

    expect(await requireModeratorForCountry(TEST_COUNTRY_CODE)).toBeNull();
  });

  it("gir en moderator tilgang til SITT tildelte land", async () => {
    await ensureTestCountry();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);
    const { requireModeratorForCountry } = await import("./authorize");

    const session = await requireModeratorForCountry(TEST_COUNTRY_CODE);

    expect(session?.userId).toBe(moderator.id);
  });

  it("nekter en moderator tilgang til et land de IKKE er tildelt", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);
    const { requireModeratorForCountry } = await import("./authorize");

    expect(await requireModeratorForCountry(TEST_COUNTRY_CODE_2)).toBeNull();
  });

  it("gir en administrator tilgang til ETHVERT land, uten egen tildelingsrad (19.4)", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const admin = await createAdmin();
    await loginAs(admin.id);
    const { requireModeratorForCountry } = await import("./authorize");

    expect((await requireModeratorForCountry(TEST_COUNTRY_CODE))?.userId).toBe(admin.id);
    expect((await requireModeratorForCountry(TEST_COUNTRY_CODE_2))?.userId).toBe(admin.id);
  });

  it("nekter en vanlig mottaker/journalist, uansett land", async () => {
    await ensureTestCountry();
    const [recipient] = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("plain-recipient"),
        role: "recipient",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    await loginAs(recipient!.id);
    const { requireModeratorForCountry } = await import("./authorize");

    expect(await requireModeratorForCountry(TEST_COUNTRY_CODE)).toBeNull();
  });
});

describe("requireAdmin mot ekte Postgres (16.2: kun administrator, ikke moderator)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returnerer null når ingen økt finnes", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    const { requireAdmin } = await import("./authorize");

    expect(await requireAdmin()).toBeNull();
  });

  it("gir en administrator tilgang", async () => {
    await ensureTestCountry();
    const admin = await createAdmin();
    await loginAs(admin.id);
    const { requireAdmin } = await import("./authorize");

    expect((await requireAdmin())?.userId).toBe(admin.id);
  });

  it("nekter en moderator, selv med et tildelt land", async () => {
    await ensureTestCountry();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);
    const { requireAdmin } = await import("./authorize");

    expect(await requireAdmin()).toBeNull();
  });
});

describe("getAssignedCountryCodes mot ekte Postgres", () => {
  it("returnerer literalen 'all' for en administrator, ikke en tom liste", async () => {
    await ensureTestCountry();
    const admin = await createAdmin();
    const { getAssignedCountryCodes } = await import("./authorize");

    const result = await getAssignedCountryCodes({
      sessionId: "s",
      userId: admin.id,
      role: "admin",
      countryCode: TEST_COUNTRY_CODE,
      locale: "nb-NO",
      email: "admin@example.invalid",
      displayName: null,
    });

    expect(result).toBe("all");
  });

  it("returnerer nøyaktig en moderators tildelte land, ikke andres", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    const { getAssignedCountryCodes } = await import("./authorize");

    const result = await getAssignedCountryCodes({
      sessionId: "s",
      userId: moderator.id,
      role: "moderator",
      countryCode: TEST_COUNTRY_CODE,
      locale: "nb-NO",
      email: "moderator@example.invalid",
      displayName: null,
    });

    expect(result).toEqual([TEST_COUNTRY_CODE]);
  });

  it("returnerer en tom liste for en moderator uten noen tildelte land", async () => {
    await ensureTestCountry();
    const [moderator] = await db
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
    if (moderator) createdModeratorIds.push(moderator.id);
    const { getAssignedCountryCodes } = await import("./authorize");

    const result = await getAssignedCountryCodes({
      sessionId: "s",
      userId: moderator!.id,
      role: "moderator",
      countryCode: TEST_COUNTRY_CODE,
      locale: "nb-NO",
      email: "moderator@example.invalid",
      displayName: null,
    });

    expect(result).toEqual([]);
  });
});

// Rydder ALLE moderatorer/administratorer opprettet av
// createModerator()/createAdmin() på tvers av HELE filen (tre
// describe-blokker) — se createdModeratorIds/createdAdminIds sin egen
// kommentar. sessions FØRST: loginAs() setter inn en økt for de fleste
// av disse, og users.id har ingen kaskadesletting.
afterAll(async () => {
  const allIds = [...createdModeratorIds, ...createdAdminIds];
  if (allIds.length === 0) return;
  await db.delete(sessions).where(inArray(sessions.userId, allIds));
  await db.delete(moderatorCountries).where(inArray(moderatorCountries.moderatorUserId, createdModeratorIds));
  await db.delete(users).where(inArray(users.id, allIds));
});
