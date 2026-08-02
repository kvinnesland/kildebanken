import { afterEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, requests, responses, sessions, users } from "@/db/schema";
import {
  createActiveJournalist,
  createActiveRecipient,
  ensureTestCountry,
  TEST_COUNTRY_CODE,
  uniqueTestEmail,
} from "@/db/integration/fixtures";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { getResponseForAdmin } from "./responses";

// Samme mønster som resten av admin/moderation-testene.
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

describe("getResponseForAdmin mot ekte Postgres (SPEC-V1.md 16.2, FR-051)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("nektes uten en administrator-økt (FR-051: administrator spesifikt, ikke moderator)", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const respondent = await createActiveRecipient();
    const [request] = await db
      .insert(requests)
      .values({
        journalistId: journalist.id,
        countryCode: TEST_COUNTRY_CODE,
        contentLanguage: "nb-NO",
        title: "Testforespørsel for admin-oppslag",
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
    const [response] = await db
      .insert(responses)
      .values({
        requestId: request!.id,
        respondentId: respondent.id,
        relevanceStatement: "Relevant.",
        answerText: "Svar.",
      })
      .returning({ id: responses.id });

    const [moderator] = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("moderator"),
        role: "moderator",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    await loginAs(moderator!.id);

    const result = await getResponseForAdmin(response!.id, "abuse_report_investigation");

    expect(result).toEqual({ ok: false, error: "errors.not_authorized" });

    await db.delete(responses).where(eq(responses.id, response!.id));
    await db.delete(requests).where(eq(requests.id, request!.id));
    // Reelt hull frem til nå (se NATTLOGG.md): denne moderatoren ble
    // aldri ryddet bort.
    await db.delete(sessions).where(eq(sessions.userId, moderator!.id));
    await db.delete(users).where(eq(users.id, moderator!.id));
  });

  it("returnerer svaret og logger oppslaget MED begrunnelsen (16.2)", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const respondent = await createActiveRecipient();
    const admin = await createAdmin();
    await loginAs(admin.id);

    const [request] = await db
      .insert(requests)
      .values({
        journalistId: journalist.id,
        countryCode: TEST_COUNTRY_CODE,
        contentLanguage: "nb-NO",
        title: "Testforespørsel for admin-oppslag",
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
    const [response] = await db
      .insert(responses)
      .values({
        requestId: request!.id,
        respondentId: respondent.id,
        relevanceStatement: "Relevant.",
        answerText: "Svaret som skal undersøkes.",
      })
      .returning({ id: responses.id });

    const result = await getResponseForAdmin(response!.id, "security_incident");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.answerText).toBe("Svaret som skal undersøkes.");
    }

    const [log] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, "response.admin_view"), eq(auditLogs.entityId, response!.id)));
    expect(log?.reason).toBe("security_incident");
    expect(log?.countryCode).toBe(TEST_COUNTRY_CODE);

    await db.delete(responses).where(eq(responses.id, response!.id));
    await db.delete(requests).where(eq(requests.id, request!.id));
  });

  it("returnerer svaret UANSETT lifecycle_status (inkludert hidden_by_moderator) — bevisst, i motsetning til journalistens egen innboks", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const respondent = await createActiveRecipient();
    const admin = await createAdmin();
    await loginAs(admin.id);

    const [request] = await db
      .insert(requests)
      .values({
        journalistId: journalist.id,
        countryCode: TEST_COUNTRY_CODE,
        contentLanguage: "nb-NO",
        title: "Testforespørsel for admin-oppslag",
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
    const [response] = await db
      .insert(responses)
      .values({
        requestId: request!.id,
        respondentId: respondent.id,
        relevanceStatement: "Relevant.",
        answerText: "Skjult svar.",
        lifecycleStatus: "hidden_by_moderator",
      })
      .returning({ id: responses.id });

    const result = await getResponseForAdmin(response!.id, "abuse_report_investigation");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.lifecycleStatus).toBe("hidden_by_moderator");
    }

    await db.delete(responses).where(eq(responses.id, response!.id));
    await db.delete(requests).where(eq(requests.id, request!.id));
  });

  it("errors.not_found for en ikke-eksisterende svar-ID", async () => {
    await ensureTestCountry();
    const admin = await createAdmin();
    await loginAs(admin.id);

    const result = await getResponseForAdmin(
      "00000000-0000-0000-0000-000000000000",
      "user_support_request"
    );

    expect(result).toEqual({ ok: false, error: "errors.not_found" });
  });
});
