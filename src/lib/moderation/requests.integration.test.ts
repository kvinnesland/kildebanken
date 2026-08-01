import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { moderatorCountries, requests, sessions, users } from "@/db/schema";
import {
  ensureSecondTestCountry,
  ensureTestCountry,
  TEST_COUNTRY_CODE,
  TEST_COUNTRY_CODE_2,
  uniqueTestEmail,
} from "@/db/integration/fixtures";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { publishRequest, rejectRequest, requestChanges } from "./requests";

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
    await loginAs(admin.id);

    const result = await publishRequest(request.id);

    expect(result.ok).toBe(true);
  });
});
