import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  authTokens,
  contactRequests,
  emailSubscriptions,
  requests,
  responses,
  sessions,
  users,
} from "@/db/schema";
import {
  createActiveJournalist,
  createActiveRecipient,
  ensureTestCountry,
  TEST_COUNTRY_CODE,
} from "@/db/integration/fixtures";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { confirmAccountDeletion, requestAccountDeletion } from "./account-deletion";

// Verken requestAccountDeletion()/confirmAccountDeletion() eller noen av
// funksjonene de kaller internt (performAccountDeletion,
// anonymizeRecipientContent, closeJournalistContentOnDeletion) leser
// getCurrentSession() — begge tar en eksplisitt parameter (userId/rawToken)
// og hadde derfor INGEN sesjonsavhengighet i det hele tatt. Null test-
// dekning her skyldtes bare at ingen hadde skrevet testfilen ennå — samme
// kategori som tick.ts sine jobbfunksjoner, se NATTLOGG.md.

async function insertDeleteToken(userId: string, overrides: Partial<typeof authTokens.$inferInsert> = {}) {
  const rawToken = generateToken();
  await db.insert(authTokens).values({
    userId,
    tokenHash: hashToken(rawToken),
    purpose: "delete_account",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    ...overrides,
  });
  return rawToken;
}

describe("requestAccountDeletion mot ekte Postgres", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("oppretter et delete_account-token og sender bekreftelseslenken", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const recipient = await createActiveRecipient();

    await requestAccountDeletion(recipient.id);

    const [token] = await db.select().from(authTokens).where(eq(authTokens.userId, recipient.id));
    expect(token?.purpose).toBe("delete_account");
    expect(token?.usedAt).toBeNull();
    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes("confirm_account_deletion"))).toBe(
      true
    );
  });

  it("gjør ingenting for en allerede slettet konto (avslører ikke kontostatus)", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    await db.update(users).set({ status: "deleted" }).where(eq(users.id, recipient.id));

    await requestAccountDeletion(recipient.id);

    const tokens = await db.select().from(authTokens).where(eq(authTokens.userId, recipient.id));
    expect(tokens).toHaveLength(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("confirmAccountDeletion mot ekte Postgres — tokenvalidering", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("avviser et ikke-eksisterende token", async () => {
    const result = await confirmAccountDeletion("dette-tokenet-finnes-ikke");
    expect(result).toEqual({ ok: false, error: "errors.not_found" });
  });

  it("avviser et allerede brukt token", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const rawToken = await insertDeleteToken(recipient.id, { usedAt: new Date() });

    const result = await confirmAccountDeletion(rawToken);

    expect(result).toEqual({ ok: false, error: "errors.not_found" });
  });

  it("avviser et utløpt token", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const rawToken = await insertDeleteToken(recipient.id, {
      expiresAt: new Date(Date.now() - 60 * 1000),
    });

    const result = await confirmAccountDeletion(rawToken);

    expect(result).toEqual({ ok: false, error: "errors.not_found" });
  });
});

describe("confirmAccountDeletion mot ekte Postgres — mottaker (SPEC-V1.md 17.5)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("anonymiserer kontoen, avslutter økter, avmelder e-post, og logger revisjonshandlingen", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const originalEmail = recipient.email;

    const rawSessionToken = generateToken();
    await db.insert(sessions).values({
      userId: recipient.id,
      tokenHash: hashToken(rawSessionToken),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await db.insert(emailSubscriptions).values({
      userId: recipient.id,
      status: "active",
      unsubscribeTokenHash: hashToken(generateToken()),
    });

    const rawToken = await insertDeleteToken(recipient.id);
    const result = await confirmAccountDeletion(rawToken);

    expect(result).toEqual({ ok: true });

    const [user] = await db.select().from(users).where(eq(users.id, recipient.id));
    expect(user?.status).toBe("deleted");
    expect(user?.email).not.toBe(originalEmail);
    expect(user?.emailHash).not.toBeNull();
    expect(user?.displayName).toBeNull();
    expect(user?.deletedAt).not.toBeNull();

    const [session] = await db.select().from(sessions).where(eq(sessions.userId, recipient.id));
    expect(session?.revokedAt).not.toBeNull();

    const [subscription] = await db
      .select()
      .from(emailSubscriptions)
      .where(eq(emailSubscriptions.userId, recipient.id));
    expect(subscription?.status).toBe("unsubscribed");

    expect(
      warnSpy.mock.calls.some((call) => String(call[0]).includes("account_deletion_confirmed"))
    ).toBe(true);
  });

  it("anonymiserer innsendte svar og kansellerer ventende kontaktforespørsler, med varsel til journalisten", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const recipient = await createActiveRecipient();

    const [request] = await db
      .insert(requests)
      .values({
        journalistId: journalist.id,
        countryCode: TEST_COUNTRY_CODE,
        contentLanguage: "nb-NO",
        title: "Testforespørsel for kontosletting",
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
        respondentId: recipient.id,
        relevanceStatement: "Relevant.",
        answerText: "Svar.",
        displayNameSnapshot: "Kari Nordmann",
        contactSharing: "email",
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

    const rawToken = await insertDeleteToken(recipient.id);
    const result = await confirmAccountDeletion(rawToken);

    expect(result).toEqual({ ok: true });

    const [afterResponse] = await db.select().from(responses).where(eq(responses.id, response.id));
    expect(afterResponse?.contactSharing).toBe("none");
    expect(afterResponse?.displayNameSnapshot).toBeNull();

    const [afterContactRequest] = await db
      .select()
      .from(contactRequests)
      .where(eq(contactRequests.responseId, response.id));
    expect(afterContactRequest?.status).toBe("cancelled");

    expect(
      warnSpy.mock.calls.some((call) =>
        String(call[0]).includes("contact_request_cancelled_account_deleted")
      )
    ).toBe(true);

    await db.delete(contactRequests).where(eq(contactRequests.responseId, response.id));
    await db.delete(responses).where(eq(responses.id, response.id));
    await db.delete(requests).where(eq(requests.id, request.id));
  });
});

describe("confirmAccountDeletion mot ekte Postgres — journalist (SPEC-V1.md 17.5, siste avsnitt)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("lukker journalistens publiserte forespørsler og varsler respondentene, med utløpte kontaktforespørsler", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const respondent = await createActiveRecipient();

    const [request] = await db
      .insert(requests)
      .values({
        journalistId: journalist.id,
        countryCode: TEST_COUNTRY_CODE,
        contentLanguage: "nb-NO",
        slug: "journalist-sletter-konto",
        title: "Forespørsel som mister journalisten sin",
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
        lifecycleStatus: "submitted",
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

    const rawToken = await insertDeleteToken(journalist.id);
    const result = await confirmAccountDeletion(rawToken);

    expect(result).toEqual({ ok: true });

    const [afterRequest] = await db.select().from(requests).where(eq(requests.id, request.id));
    expect(afterRequest?.status).toBe("closed");
    expect(afterRequest?.closedAt).not.toBeNull();

    const [afterContactRequest] = await db
      .select()
      .from(contactRequests)
      .where(eq(contactRequests.responseId, response.id));
    expect(afterContactRequest?.status).toBe("expired");

    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes("response_request_closed"))).toBe(
      true
    );

    const [journalistUser] = await db.select().from(users).where(eq(users.id, journalist.id));
    expect(journalistUser?.status).toBe("deleted");

    await db.delete(contactRequests).where(eq(contactRequests.responseId, response.id));
    await db.delete(responses).where(eq(responses.id, response.id));
    await db.delete(requests).where(eq(requests.id, request.id));
  });
});
