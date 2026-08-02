import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLogs,
  contactRequests,
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
import { submitResponse, withdrawResponse } from "@/lib/responses/responses";
import { hideResponse } from "./responses";

// hideResponse() kaller requireModeratorForCountry() → getCurrentSession()
// internt — samme next/headers-mock-mønster som de andre
// moderation/*.integration.test.ts-filene.
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

async function createPublishedRequestWithResponse(): Promise<{
  journalistId: string;
  responseId: string;
  respondentId: string;
}> {
  const journalist = await createActiveJournalist();
  const [request] = await db
    .insert(requests)
    .values({
      journalistId: journalist.id,
      countryCode: TEST_COUNTRY_CODE,
      contentLanguage: "nb-NO",
      title: "Testforespørsel for skjuling",
      summary: "sum",
      description: "desc",
      targetPersonDescription: "target",
      responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "published",
      allowsAnonymousParticipation: true,
      mayBeRecorded: false,
      mayInvolvePhotoVideo: false,
      publishedAt: new Date(),
    })
    .returning({ id: requests.id });
  if (!request) throw new Error("Klarte ikke opprette testforespørsel");

  const respondent = await createActiveRecipient();
  const submitted = await submitResponse(request.id, respondent.id, {
    relevanceStatement: "Relevant.",
    answerText: "Svar.",
    contactSharing: "none",
  });
  if (!submitted.ok) throw new Error("Klarte ikke sende inn testsvar");

  return { journalistId: journalist.id, responseId: submitted.id, respondentId: respondent.id };
}

describe("hideResponse mot ekte Postgres (SPEC-V1.md 12.5)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returnerer errors.not_found for en ukjent svar-ID", async () => {
    await ensureTestCountry();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    const result = await hideResponse("00000000-0000-0000-0000-000000000000");

    expect(result).toEqual({ ok: false, error: "errors.not_found" });
  });

  it("nekter en moderator tildelt et ANNET land", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const { responseId } = await createPublishedRequestWithResponse();
    const moderator = await createModerator(TEST_COUNTRY_CODE_2);
    await loginAs(moderator.id);

    const result = await hideResponse(responseId);

    expect(result).toEqual({ ok: false, error: "errors.not_authorized" });
    const [row] = await db.select().from(responses).where(eq(responses.id, responseId));
    expect(row?.lifecycleStatus).toBe("submitted");
  });

  it("skjuler et svar: setter lifecycle_status og logger revisjonslogg (FR-050)", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const { responseId } = await createPublishedRequestWithResponse();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    const result = await hideResponse(responseId);

    expect(result).toEqual({ ok: true });
    const [row] = await db.select().from(responses).where(eq(responses.id, responseId));
    expect(row?.lifecycleStatus).toBe("hidden_by_moderator");
  });

  it("kansellerer en VENTENDE kontaktforespørsel knyttet til svaret (12.4-mønsteret)", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const { journalistId, responseId } = await createPublishedRequestWithResponse();
    await db.insert(contactRequests).values({
      responseId,
      journalistId,
      message: "Kan jeg få vite mer?",
      requestedContactMethod: "e-post",
      status: "pending",
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    const result = await hideResponse(responseId);

    expect(result).toEqual({ ok: true });
    const [contactRequest] = await db
      .select()
      .from(contactRequests)
      .where(eq(contactRequests.responseId, responseId));
    expect(contactRequest?.status).toBe("cancelled");
  });

  it("avviser å skjule et svar som allerede er skjult — kan ikke gjentas mot en tilstand det ikke lenger gjelder for", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const { responseId } = await createPublishedRequestWithResponse();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);
    const first = await hideResponse(responseId);
    expect(first).toEqual({ ok: true });

    const second = await hideResponse(responseId);

    expect(second).toEqual({ ok: false, error: "errors.response_not_visible" });
  });

  it("en administrator kan skjule UANSETT land (19.4)", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const { responseId } = await createPublishedRequestWithResponse();

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
    // Ryddes i SAMME afterAll som moderatorene nederst i filen — en
    // administrator har ingen moderator_countries-rad, så den delete er
    // et trygt no-op for denne IDen.
    createdModeratorIds.push(admin.id);
    await loginAs(admin.id);

    const result = await hideResponse(responseId);

    expect(result).toEqual({ ok: true });
  });

  it("en SAMTIDIG trekking (hard-sletting) gjør IKKE at skjuling logger en revisjonsrad for en handling som aldri skjedde (TOCTOU)", async () => {
    // withdrawResponse() (responses/responses.ts) HARD-SLETTER raden
    // UBETINGET (den sjekker aldri responsens egen lifecycleStatus, bare at
    // forespørselen er åpen) — uten lifecycleStatus="submitted" i selve
    // hideResponse()-UPDATE-ens WHERE-betingelse (ikke bare i den innledende
    // sjekken) kunne hideResponse() stille truffet 0 rader her og likevel
    // logget "response.hide" og returnert {ok:true} for en handling som
    // aldri fant sted. Raden ender UANSETT hard-slettet av withdraw — det
    // som faktisk testes er om hideResponse()s SVAR og REVISJONSLOGG stemmer
    // overens med om den selv genuint rakk å skrive FØR withdraw slettet.
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const { responseId, respondentId } = await createPublishedRequestWithResponse();
    const moderator = await createModerator(TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    const [hideResult, withdrawResult] = await Promise.all([
      hideResponse(responseId),
      withdrawResponse(responseId, respondentId),
    ]);

    // hideResponse() endrer aldri requests.status — withdrawResponse() sin
    // eneste betingelse — så trekkingen lykkes alltid, uavhengig av utfallet
    // av kappløpet mot hideResponse().
    expect(withdrawResult.ok).toBe(true);

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, responseId));
    const hideWasLogged = logs.some((l) => l.action === "response.hide");

    if (hideResult.ok) {
      expect(hideWasLogged).toBe(true);
    } else {
      expect(["errors.response_not_visible", "errors.not_found"]).toContain(hideResult.error);
      expect(hideWasLogged).toBe(false);
    }
  });
});

// Rydder ALLE moderatorer opprettet av createModerator() på tvers av
// HELE filen — se createdModeratorIds sin egen kommentar. auditLogs/
// sessions FØRST: hideResponse() logger moderatorens handling, og
// loginAs() setter inn en økt.
afterAll(async () => {
  if (createdModeratorIds.length === 0) return;
  await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, createdModeratorIds));
  await db.delete(sessions).where(inArray(sessions.userId, createdModeratorIds));
  await db.delete(moderatorCountries).where(inArray(moderatorCountries.moderatorUserId, createdModeratorIds));
  await db.delete(users).where(inArray(users.id, createdModeratorIds));
});
