import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, contactRequests, requests } from "@/db/schema";
import {
  createActiveJournalist,
  createActiveRecipient,
  ensureTestCountry,
  TEST_COUNTRY_CODE,
} from "@/db/integration/fixtures";
import { submitResponse } from "@/lib/responses/responses";
import {
  createContactRequest,
  getContactRequestDetail,
  respondToContactRequest,
} from "./contact-requests";

// Ingen next/headers-avhengighet (samme kategori som magic-link.ts):
// funksjonene her tar allerede-autentiserte bruker-ID-er som argumenter, ikke
// en økt selv — ingen vi.mock() nødvendig.

async function createPublishedRequestWithJournalist(): Promise<{
  journalistId: string;
  requestId: string;
}> {
  const journalist = await createActiveJournalist();
  const [request] = await db
    .insert(requests)
    .values({
      journalistId: journalist.id,
      countryCode: TEST_COUNTRY_CODE,
      contentLanguage: "nb-NO",
      title: "Testforespørsel for kontaktforespørsler",
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
  return { journalistId: journalist.id, requestId: request.id };
}

async function createSubmittedResponse(
  requestId: string,
  contactSharing: "none" | "email" = "none"
): Promise<{ responseId: string; respondentId: string }> {
  const respondent = await createActiveRecipient();
  const result = await submitResponse(requestId, respondent.id, {
    relevanceStatement: "Jeg er relevant.",
    answerText: "Svaret mitt.",
    contactSharing,
  });
  if (!result.ok) throw new Error("Klarte ikke sende inn testsvar");
  return { responseId: result.id, respondentId: respondent.id };
}

describe("createContactRequest mot ekte Postgres (FR-040, SPEC-V1.md 14.1)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("avviser en tom melding", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    const { journalistId, requestId } = await createPublishedRequestWithJournalist();
    const { responseId } = await createSubmittedResponse(requestId);

    const result = await createContactRequest(responseId, journalistId, {
      message: "   ",
      requestedContactMethod: "e-post",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("errors.validation_failed");
  });

  it("avviser en melding over 1000 tegn (14.1)", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    const { journalistId, requestId } = await createPublishedRequestWithJournalist();
    const { responseId } = await createSubmittedResponse(requestId);

    const result = await createContactRequest(responseId, journalistId, {
      message: "x".repeat(1001),
      requestedContactMethod: "e-post",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("errors.validation_failed");
  });

  it("avviser en journalist som IKKE eier forespørselen svaret gjelder", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    const { requestId } = await createPublishedRequestWithJournalist();
    const { responseId } = await createSubmittedResponse(requestId);
    const otherJournalist = await createActiveJournalist();

    const result = await createContactRequest(responseId, otherJournalist.id, {
      message: "Kan jeg få vite mer?",
      requestedContactMethod: "e-post",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("errors.not_authorized");
  });

  it("avviser når respondenten allerede har delt e-postadressen (14.1)", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    const { journalistId, requestId } = await createPublishedRequestWithJournalist();
    const { responseId } = await createSubmittedResponse(requestId, "email");

    const result = await createContactRequest(responseId, journalistId, {
      message: "Kan jeg få vite mer?",
      requestedContactMethod: "e-post",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("errors.contact_already_shared");
  });

  it("oppretter en kontaktforespørsel og varsler respondenten", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { journalistId, requestId } = await createPublishedRequestWithJournalist();
    const { responseId } = await createSubmittedResponse(requestId);

    const result = await createContactRequest(responseId, journalistId, {
      message: "Kan jeg få vite mer?",
      requestedContactMethod: "e-post",
    });

    expect(result.ok).toBe(true);
    expect(
      warnSpy.mock.calls.some((call) => String(call[0]).includes("contact_request_received"))
    ).toBe(true);
  });

  it("FR-043: avviser en ANDRE kontaktforespørsel på SAMME svar — håndhevet av Postgres", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { journalistId, requestId } = await createPublishedRequestWithJournalist();
    const { responseId } = await createSubmittedResponse(requestId);

    const first = await createContactRequest(responseId, journalistId, {
      message: "Første forespørsel.",
      requestedContactMethod: "e-post",
    });
    expect(first.ok).toBe(true);

    const second = await createContactRequest(responseId, journalistId, {
      message: "Andre forespørsel.",
      requestedContactMethod: "e-post",
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe("errors.contact_request_already_sent");
  });
});

describe("respondToContactRequest mot ekte Postgres (FR-041, SPEC-V1.md 14.2/14.3)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("avviser en respondent som ikke eier svaret kontaktforespørselen gjelder", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { journalistId, requestId } = await createPublishedRequestWithJournalist();
    const { responseId } = await createSubmittedResponse(requestId);
    const created = await createContactRequest(responseId, journalistId, {
      message: "Kan jeg få vite mer?",
      requestedContactMethod: "e-post",
    });
    if (!created.ok) throw new Error("fail create");
    const otherRespondent = await createActiveRecipient();

    const result = await respondToContactRequest(created.id, otherRespondent.id, "approved");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("errors.not_found");
  });

  it("godkjenner: setter delt e-post, logger revisjonslogg UTEN e-postadresse i metadata, og varsler journalisten", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { journalistId, requestId } = await createPublishedRequestWithJournalist();
    const { responseId, respondentId } = await createSubmittedResponse(requestId);
    const created = await createContactRequest(responseId, journalistId, {
      message: "Kan jeg få vite mer?",
      requestedContactMethod: "e-post",
    });
    if (!created.ok) throw new Error("fail create");
    warnSpy.mockClear();

    const [before] = await db.select().from(contactRequests).where(eq(contactRequests.id, created.id));

    const result = await respondToContactRequest(created.id, respondentId, "approved");

    expect(result.ok).toBe(true);
    const [row] = await db.select().from(contactRequests).where(eq(contactRequests.id, created.id));
    expect(row?.status).toBe("approved");
    expect(row?.sharedEmail).toBeTruthy();
    expect(row?.respondedAt).not.toBeNull();
    // Reelt hull frem til denne økten (se NATTLOGG.md): `updatedAt` sto
    // tidligere frosset på innsettingstidspunktet ved ALLE overganger vekk
    // fra `pending` — ingenting satte den eksplisitt, til tross for at
    // retention.ts's purgeOldContactRequests() er avhengig av at den
    // FAKTISK endres (brukes som tilnærming for "avsluttet", SPEC-V1.md
    // 17.4). Denne testen ville fanget akkurat den regresjonen.
    expect(row?.updatedAt.getTime()).toBeGreaterThan(before?.updatedAt.getTime() ?? 0);

    const [log] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, created.id));
    expect(log?.action).toBe("contact_request.approve");
    expect(JSON.stringify(log?.metadata ?? {})).not.toContain(row?.sharedEmail);

    expect(
      warnSpy.mock.calls.some((call) => String(call[0]).includes("contact_approved"))
    ).toBe(true);
  });

  it("avslår: setter status uten sharedEmail, og varsler journalisten UTEN begrunnelse (14.2)", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { journalistId, requestId } = await createPublishedRequestWithJournalist();
    const { responseId, respondentId } = await createSubmittedResponse(requestId);
    const created = await createContactRequest(responseId, journalistId, {
      message: "Kan jeg få vite mer?",
      requestedContactMethod: "e-post",
    });
    if (!created.ok) throw new Error("fail create");
    warnSpy.mockClear();

    const [before] = await db.select().from(contactRequests).where(eq(contactRequests.id, created.id));

    const result = await respondToContactRequest(created.id, respondentId, "declined");

    expect(result.ok).toBe(true);
    const [row] = await db.select().from(contactRequests).where(eq(contactRequests.id, created.id));
    expect(row?.status).toBe("declined");
    expect(row?.sharedEmail).toBeNull();
    // Se den tilsvarende kommentaren i "godkjenner"-testen over.
    expect(row?.updatedAt.getTime()).toBeGreaterThan(before?.updatedAt.getTime() ?? 0);
    expect(
      warnSpy.mock.calls.some((call) => String(call[0]).includes("contact_declined"))
    ).toBe(true);
  });

  it("avviser å svare på en kontaktforespørsel som ikke lenger er pending", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { journalistId, requestId } = await createPublishedRequestWithJournalist();
    const { responseId, respondentId } = await createSubmittedResponse(requestId);
    const created = await createContactRequest(responseId, journalistId, {
      message: "Kan jeg få vite mer?",
      requestedContactMethod: "e-post",
    });
    if (!created.ok) throw new Error("fail create");
    const first = await respondToContactRequest(created.id, respondentId, "approved");
    expect(first.ok).toBe(true);

    const second = await respondToContactRequest(created.id, respondentId, "declined");

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe("errors.contact_request_not_pending");
  });

  it("avviser en forespørsel forbi expiresAt selv om status fortsatt er pending (runExpireContactRequests har ikke rukket å kjøre ennå)", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { journalistId, requestId } = await createPublishedRequestWithJournalist();
    const { responseId, respondentId } = await createSubmittedResponse(requestId);
    const created = await createContactRequest(responseId, journalistId, {
      message: "Kan jeg få vite mer?",
      requestedContactMethod: "e-post",
    });
    if (!created.ok) throw new Error("fail create");

    // Simulerer at 14-dagersfristen faktisk er passert, men den periodiske
    // runExpireContactRequests()-jobben ikke har rukket å flippe status ennå.
    await db
      .update(contactRequests)
      .set({ expiresAt: new Date(Date.now() - 60 * 1000) })
      .where(eq(contactRequests.id, created.id));

    const result = await respondToContactRequest(created.id, respondentId, "approved");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("errors.contact_request_not_pending");

    const [afterAttempt] = await db.select().from(contactRequests).where(eq(contactRequests.id, created.id));
    expect(afterAttempt?.status).toBe("pending"); // uendret — verken godkjent eller flippet av selve kallet
    expect(afterAttempt?.sharedEmail).toBeNull();
  });
});

describe("getContactRequestDetail mot ekte Postgres", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returnerer null for en bruker som verken er journalisten eller respondenten", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { journalistId, requestId } = await createPublishedRequestWithJournalist();
    const { responseId } = await createSubmittedResponse(requestId);
    const created = await createContactRequest(responseId, journalistId, {
      message: "Kan jeg få vite mer?",
      requestedContactMethod: "e-post",
    });
    if (!created.ok) throw new Error("fail create");
    const outsider = await createActiveRecipient();

    expect(await getContactRequestDetail(created.id, outsider.id)).toBeNull();
  });

  it("skjuler sharedEmail for journalisten før godkjenning, men ikke for respondenten", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { journalistId, requestId } = await createPublishedRequestWithJournalist();
    const { responseId, respondentId } = await createSubmittedResponse(requestId);
    const created = await createContactRequest(responseId, journalistId, {
      message: "Kan jeg få vite mer?",
      requestedContactMethod: "e-post",
    });
    if (!created.ok) throw new Error("fail create");
    await db
      .update(contactRequests)
      .set({ sharedEmail: "not-yet-visible@example.invalid" })
      .where(eq(contactRequests.id, created.id));

    const asJournalist = await getContactRequestDetail(created.id, journalistId);
    expect(asJournalist?.sharedEmail).toBeNull();

    const asRespondent = await getContactRequestDetail(created.id, respondentId);
    expect(asRespondent?.sharedEmail).toBe("not-yet-visible@example.invalid");
  });

  it("viser sharedEmail til journalisten ETTER godkjenning", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { journalistId, requestId } = await createPublishedRequestWithJournalist();
    const { responseId, respondentId } = await createSubmittedResponse(requestId);
    const created = await createContactRequest(responseId, journalistId, {
      message: "Kan jeg få vite mer?",
      requestedContactMethod: "e-post",
    });
    if (!created.ok) throw new Error("fail create");
    await respondToContactRequest(created.id, respondentId, "approved");

    const asJournalist = await getContactRequestDetail(created.id, journalistId);
    expect(asJournalist?.sharedEmail).toBeTruthy();
  });
});
