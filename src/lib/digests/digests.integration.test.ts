import { afterEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLogs,
  digestDeliveries,
  digests,
  emailSubscriptions,
  moderatorCountries,
  sessions,
  users,
} from "@/db/schema";
import {
  ensureSecondTestCountry,
  ensureTestCountry,
  TEST_COUNTRY_CODE,
  TEST_COUNTRY_CODE_2,
  uniqueTestEmail,
} from "@/db/integration/fixtures";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import type { CurrentSession } from "@/lib/auth/session";
import * as emailSend from "@/lib/email/send";

// listDigests()/retryFailedDigestDeliveries() kaller
// getAssignedCountryCodes()/requireModeratorForCountry() internt, som leser
// getCurrentSession() (en next/headers-cookie) — samme mocking-mønster som
// moderation/requests.integration.test.ts.
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
import { cookies } from "next/headers";

function uniqueScheduledFor(): string {
  // Unngår kollisjon med det unike (country_code, scheduled_for)-paret ved
  // gjentatt kjøring — tilfeldig dato over et bredt spekter, ikke en
  // hardkodet streng (samme lærdom som magic-link-tokenene tidligere denne
  // økten). 10 millioner dager (ikke 1000, se NATTLOGG.md) — SAMME formel
  // fantes uavhengig i to andre testfiler mot samme TEST_COUNTRY_CODE, og et
  // spekter på bare 1000 dager ga en reell, bekreftet fødselsdagsparadoks-
  // kollisjonsrisiko på tvers av filene i en delt, aldri nullstilt database
  // med hundrevis av allerede opprettede rader for landet.
  const randomMs = Math.floor(Math.random() * 10_000_000 * 24 * 60 * 60 * 1000);
  return new Date(Date.now() + randomMs).toISOString().slice(0, 10);
}

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
  return admin;
}

describe("listDigests mot ekte Postgres (SPEC-V1.md 16.2)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
    const { listDigests } = await import("./digests");

    const result = await listDigests(
      makeSession({ userId: unassignedModerator!.id, role: "moderator", countryCode: TEST_COUNTRY_CODE })
    );

    expect(result).toEqual([]);
  });

  it("filtrerer på moderatorens tildelte land, ikke andre lands digester", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    const { listDigests } = await import("./digests");

    const [ownDigest] = await db
      .insert(digests)
      .values({
        countryCode: TEST_COUNTRY_CODE,
        scheduledFor: uniqueScheduledFor(),
        requestIds: [],
        status: "sent",
      })
      .returning({ id: digests.id });
    const [otherDigest] = await db
      .insert(digests)
      .values({
        countryCode: TEST_COUNTRY_CODE_2,
        scheduledFor: uniqueScheduledFor(),
        requestIds: [],
        status: "sent",
      })
      .returning({ id: digests.id });

    const result = await listDigests(
      makeSession({ userId: moderator.id, role: "moderator", countryCode: TEST_COUNTRY_CODE })
    );

    expect(result.some((d) => d.id === ownDigest!.id)).toBe(true);
    expect(result.some((d) => d.id === otherDigest!.id)).toBe(false);

    await db.delete(digests).where(eq(digests.id, ownDigest!.id));
    await db.delete(digests).where(eq(digests.id, otherDigest!.id));
  });

  it("16.2: teller sendt/delivered, bounced og complained per digest, uten å blande dem sammen på tvers av to digester", async () => {
    // Var tidligere ALDRI beregnet noe sted (se NATTLOGG.md, provider_
    // message_id-fiksen) — listDigests() returnerte kun de rå Digest-
    // feltene, uten den nedbrytningen 16.2 eksplisitt krever ("antall
    // sendt, bounces, klager").
    await ensureTestCountry();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    const { listDigests } = await import("./digests");

    const [digestA] = await db
      .insert(digests)
      .values({
        countryCode: TEST_COUNTRY_CODE,
        scheduledFor: uniqueScheduledFor(),
        requestIds: [],
        status: "sent",
      })
      .returning({ id: digests.id });
    const [digestB] = await db
      .insert(digests)
      .values({
        countryCode: TEST_COUNTRY_CODE,
        scheduledFor: uniqueScheduledFor(),
        requestIds: [],
        status: "sent",
      })
      .returning({ id: digests.id });

    const recipients = await Promise.all(
      Array.from({ length: 5 }, () =>
        db
          .insert(users)
          .values({
            email: uniqueTestEmail("digest-count-recipient"),
            role: "recipient",
            status: "active",
            countryCode: TEST_COUNTRY_CODE,
            locale: "nb-NO",
            emailVerifiedAt: new Date(),
          })
          .returning({ id: users.id })
      )
    );

    await db.insert(digestDeliveries).values([
      // digestA: 2 sent, 1 bounced, 1 complained
      { digestId: digestA!.id, userId: recipients[0]![0]!.id, locale: "nb-NO", accessTokenHash: hashToken(generateToken()), status: "sent" },
      { digestId: digestA!.id, userId: recipients[1]![0]!.id, locale: "nb-NO", accessTokenHash: hashToken(generateToken()), status: "delivered" },
      { digestId: digestA!.id, userId: recipients[2]![0]!.id, locale: "nb-NO", accessTokenHash: hashToken(generateToken()), status: "bounced" },
      { digestId: digestA!.id, userId: recipients[3]![0]!.id, locale: "nb-NO", accessTokenHash: hashToken(generateToken()), status: "complained" },
      // digestB: 1 failed only — proves digestA's counts don't leak in
      { digestId: digestB!.id, userId: recipients[4]![0]!.id, locale: "nb-NO", accessTokenHash: hashToken(generateToken()), status: "failed" },
    ]);

    const result = await listDigests(
      makeSession({ userId: moderator.id, role: "moderator", countryCode: TEST_COUNTRY_CODE })
    );

    const rowA = result.find((d) => d.id === digestA!.id);
    const rowB = result.find((d) => d.id === digestB!.id);
    expect(rowA).toMatchObject({ sentCount: 2, bouncedCount: 1, complainedCount: 1, failedCount: 0 });
    expect(rowB).toMatchObject({ sentCount: 0, bouncedCount: 0, complainedCount: 0, failedCount: 1 });

    await db.delete(digestDeliveries).where(inArray(digestDeliveries.digestId, [digestA!.id, digestB!.id]));
    await db.delete(digests).where(inArray(digests.id, [digestA!.id, digestB!.id]));
  });

  it("gir en administrator ALLE lands digester (19.4)", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const { listDigests } = await import("./digests");

    const [ownDigest] = await db
      .insert(digests)
      .values({
        countryCode: TEST_COUNTRY_CODE,
        scheduledFor: uniqueScheduledFor(),
        requestIds: [],
        status: "sent",
      })
      .returning({ id: digests.id });
    const [otherDigest] = await db
      .insert(digests)
      .values({
        countryCode: TEST_COUNTRY_CODE_2,
        scheduledFor: uniqueScheduledFor(),
        requestIds: [],
        status: "sent",
      })
      .returning({ id: digests.id });

    const result = await listDigests(makeSession({ role: "admin" }));

    expect(result.some((d) => d.id === ownDigest!.id)).toBe(true);
    expect(result.some((d) => d.id === otherDigest!.id)).toBe(true);

    await db.delete(digests).where(eq(digests.id, ownDigest!.id));
    await db.delete(digests).where(eq(digests.id, otherDigest!.id));
  });
});

describe("retryFailedDigestDeliveries mot ekte Postgres (SPEC-V1.md 16.2, FR-050)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returnerer errors.not_found for en ukjent digest-ID", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const { retryFailedDigestDeliveries } = await import("./digests");

    const result = await retryFailedDigestDeliveries("00000000-0000-0000-0000-000000000000");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("errors.not_found");
  });

  it("avviser en moderator som ikke er tildelt digestens land", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    const [digest] = await db
      .insert(digests)
      .values({
        countryCode: TEST_COUNTRY_CODE_2,
        scheduledFor: uniqueScheduledFor(),
        requestIds: [],
        status: "sent",
      })
      .returning({ id: digests.id });
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);
    const { retryFailedDigestDeliveries } = await import("./digests");

    const result = await retryFailedDigestDeliveries(digest!.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("errors.not_authorized");

    await db.delete(digests).where(eq(digests.id, digest!.id));
  });

  it("er et no-op (retried: 0) når ingen leveranser har status failed", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    const [digest] = await db
      .insert(digests)
      .values({
        countryCode: TEST_COUNTRY_CODE,
        scheduledFor: uniqueScheduledFor(),
        requestIds: [],
        status: "sent",
      })
      .returning({ id: digests.id });
    const admin = await createAdmin();
    await loginAs(admin.id);
    const { retryFailedDigestDeliveries } = await import("./digests");

    const result = await retryFailedDigestDeliveries(digest!.id);

    expect(result).toEqual({ ok: true, retried: 0 });

    await db.delete(digests).where(eq(digests.id, digest!.id));
  });

  it("sender kun til leveranser med status failed, roterer avmeldingstoken, og logger revisjonslogg (FR-050)", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // 19.10/16.2: gjensendingen skal lagre Brevo sin messageId på nøyaktig
    // samme måte som førstegangsutsendelsen i tick.ts — var tidligere aldri
    // lagret noe sted, se NATTLOGG.md. Kaller den ekte (stub-)funksjonen
    // gjennom (bevarer [email:stub:bulk]-logg-antagelsen under), men
    // overstyrer selve returverdien for å bevise at DEN faktisk lagres.
    const realSendBulkEmail = emailSend.sendBulkEmail;
    vi.spyOn(emailSend, "sendBulkEmail").mockImplementation(async (input) => {
      await realSendBulkEmail(input);
      return "<retry-brevo-id@relay.brevo.com>";
    });
    const [digest] = await db
      .insert(digests)
      .values({
        countryCode: TEST_COUNTRY_CODE,
        scheduledFor: uniqueScheduledFor(),
        requestIds: [],
        recipientCount: 1,
        status: "failed",
      })
      .returning({ id: digests.id });

    const failedRecipient = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("digest-failed-recipient"),
        role: "recipient",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    const deliveredRecipient = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("digest-delivered-recipient"),
        role: "recipient",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });

    const oldUnsubscribeHash = hashToken("gammelt-avmeldingstoken");
    await db.insert(emailSubscriptions).values({
      userId: failedRecipient[0]!.id,
      unsubscribeTokenHash: oldUnsubscribeHash,
    });

    await db.insert(digestDeliveries).values([
      {
        digestId: digest!.id,
        userId: failedRecipient[0]!.id,
        locale: "nb-NO",
        accessTokenHash: hashToken(generateToken()),
        status: "failed",
        errorMessage: "Forrige forsøk feilet.",
      },
      {
        digestId: digest!.id,
        userId: deliveredRecipient[0]!.id,
        locale: "nb-NO",
        accessTokenHash: hashToken(generateToken()),
        status: "delivered",
      },
    ]);

    const admin = await createAdmin();
    await loginAs(admin.id);
    const { retryFailedDigestDeliveries } = await import("./digests");

    const result = await retryFailedDigestDeliveries(digest!.id);

    expect(result).toEqual({ ok: true, retried: 1 });

    const [retriedDelivery] = await db
      .select()
      .from(digestDeliveries)
      .where(eq(digestDeliveries.userId, failedRecipient[0]!.id));
    expect(retriedDelivery?.status).toBe("sent");
    expect(retriedDelivery?.errorMessage).toBeNull();
    expect(retriedDelivery?.providerMessageId).toBe("<retry-brevo-id@relay.brevo.com>");

    const [untouchedDelivery] = await db
      .select()
      .from(digestDeliveries)
      .where(eq(digestDeliveries.userId, deliveredRecipient[0]!.id));
    expect(untouchedDelivery?.status).toBe("delivered");

    const [subscription] = await db
      .select()
      .from(emailSubscriptions)
      .where(eq(emailSubscriptions.userId, failedRecipient[0]!.id));
    expect(subscription?.unsubscribeTokenHash).not.toBe(oldUnsubscribeHash);

    const [updatedDigest] = await db.select().from(digests).where(eq(digests.id, digest!.id));
    expect(updatedDigest?.status).toBe("sent");
    expect(updatedDigest?.recipientCount).toBe(2);

    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.entityId, digest!.id));
    expect(log?.action).toBe("digest.retry");
    expect(log?.metadata).toEqual({ retried: 1, failedFound: 1 });

    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes("[email:stub:bulk]"))).toBe(
      true
    );

    await db.delete(auditLogs).where(eq(auditLogs.entityId, digest!.id));
    await db.delete(digestDeliveries).where(eq(digestDeliveries.digestId, digest!.id));
    await db.delete(digests).where(eq(digests.id, digest!.id));
  });
});
