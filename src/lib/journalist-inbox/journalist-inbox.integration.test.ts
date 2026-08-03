import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { contactRequests, requests, responses } from "@/db/schema";
import { createActiveJournalist, createActiveRecipient, ensureTestCountry, TEST_COUNTRY_CODE } from "@/db/integration/fixtures";
import { submitResponse } from "@/lib/responses/responses";
import { createContactRequest } from "@/lib/contact-requests/contact-requests";
import {
  getResponseDetailForJournalist,
  listResponsesForRequest,
  updateResponseMarking,
} from "./journalist-inbox";

// Ingen next/headers-/økt-avhengighet — alle tre funksjonene tar allerede
// en autentisert journalistUserId som argument, samme kategori som
// contact-requests.ts.

describe("journalist-inbox mot ekte Postgres (SPEC-V1.md 13, 13.1)", () => {
  let journalistId: string;
  let requestId: string;

  beforeAll(async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    journalistId = journalist.id;

    const [request] = await db
      .insert(requests)
      .values({
        journalistId,
        countryCode: TEST_COUNTRY_CODE,
        contentLanguage: "nb-NO",
        title: "Testforespørsel for journalistinnboks",
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
    requestId = request.id;
  });

  afterAll(async () => {
    const responseIdsForRequest = db
      .select({ id: responses.id })
      .from(responses)
      .where(eq(responses.requestId, requestId));
    await db
      .delete(contactRequests)
      .where(inArray(contactRequests.responseId, responseIdsForRequest));
    await db.delete(responses).where(eq(responses.requestId, requestId));
    await db.delete(requests).where(eq(requests.id, requestId));
  });

  describe("listResponsesForRequest", () => {
    it("returnerer errors.not_found for en forespørsel journalisten ikke eier", async () => {
      const otherJournalist = await createActiveJournalist();

      const result = await listResponsesForRequest(requestId, otherJournalist.id);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("errors.not_found");
    });

    it("teller totalt/uleste/shortlistede svar og kontaktforespørsler riktig", async () => {
      const respondentA = await createActiveRecipient();
      const respondentB = await createActiveRecipient();

      const submittedA = await submitResponse(requestId, respondentA.id, {
        relevanceStatement: "A er relevant.",
        answerText: "Svar A.",
        contactSharing: "none",
      });
      const submittedB = await submitResponse(requestId, respondentB.id, {
        relevanceStatement: "B er relevant.",
        answerText: "Svar B.",
        contactSharing: "none",
      });
      if (!submittedA.ok || !submittedB.ok) throw new Error("fail submit");

      await db
        .update(responses)
        .set({ viewedAt: new Date(), journalistMarking: "shortlisted" })
        .where(eq(responses.id, submittedA.id));
      await db.insert(contactRequests).values({
        responseId: submittedA.id,
        journalistId,
        message: "Kan jeg få vite mer?",
        requestedContactMethod: "e-post",
        status: "pending",
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });

      const result = await listResponsesForRequest(requestId, journalistId);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.summary.totalResponses).toBe(2);
      expect(result.data.summary.unreadResponses).toBe(1);
      expect(result.data.summary.shortlistedResponses).toBe(1);
      expect(result.data.summary.contactRequestCount).toBe(1);

      const itemA = result.data.items.find((i) => i.id === submittedA.id);
      expect(itemA?.journalistMarking).toBe("shortlisted");
      expect(itemA?.viewedAt).not.toBeNull();
    });

    it("hasSharedEmail er true når kontaktforespørselen er GODKJENT, selv om contactSharing er none", async () => {
      const respondent = await createActiveRecipient();
      const submitted = await submitResponse(requestId, respondent.id, {
        relevanceStatement: "Relevant.",
        answerText: "Svar.",
        contactSharing: "none",
      });
      if (!submitted.ok) throw new Error("fail submit");
      await db.insert(contactRequests).values({
        responseId: submitted.id,
        journalistId,
        message: "Kan jeg få vite mer?",
        requestedContactMethod: "e-post",
        status: "approved",
        sharedEmail: respondent.email,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        respondedAt: new Date(),
      });

      const result = await listResponsesForRequest(requestId, journalistId);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const item = result.data.items.find((i) => i.id === submitted.id);
      expect(item?.hasSharedEmail).toBe(true);
    });
  });

  describe("getResponseDetailForJournalist", () => {
    it("returnerer errors.not_found for et svar som tilhører en ANNEN journalists forespørsel", async () => {
      const otherJournalist = await createActiveJournalist();
      const respondent = await createActiveRecipient();
      const submitted = await submitResponse(requestId, respondent.id, {
        relevanceStatement: "Relevant.",
        answerText: "Svar.",
        contactSharing: "none",
      });
      if (!submitted.ok) throw new Error("fail submit");

      const result = await getResponseDetailForJournalist(submitted.id, otherJournalist.id);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("errors.not_found");
    });

    it("setter viewedAt FØRSTE gang detaljvisningen åpnes, uendret ved neste kall", async () => {
      const respondent = await createActiveRecipient();
      const submitted = await submitResponse(requestId, respondent.id, {
        relevanceStatement: "Relevant.",
        answerText: "Svar.",
        contactSharing: "none",
      });
      if (!submitted.ok) throw new Error("fail submit");

      const first = await getResponseDetailForJournalist(submitted.id, journalistId);
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      expect(first.data.viewedAt).not.toBeNull();
      const firstViewedAt = first.data.viewedAt;

      const second = await getResponseDetailForJournalist(submitted.id, journalistId);
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.data.viewedAt?.getTime()).toBe(firstViewedAt?.getTime());
    });

    it("sharedEmail er den FAKTISKE adressen når contactSharing='email' (12.2: 'adressen følger svaret')", async () => {
      // Reelt hull frem til nå (se NATTLOGG.md): dette valget ble lagret og
      // korrekt håndtert av createContactRequest() (avviser en overflødig
      // kontaktforespørsel), men selve adressen ble ALDRI faktisk vist til
      // journalisten noe sted.
      const respondent = await createActiveRecipient();
      const submitted = await submitResponse(requestId, respondent.id, {
        relevanceStatement: "Relevant.",
        answerText: "Svar.",
        contactSharing: "email",
      });
      if (!submitted.ok) throw new Error("fail submit");

      const result = await getResponseDetailForJournalist(submitted.id, journalistId);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.sharedEmail).toBe(respondent.email);
    });

    it("sharedEmail er null når contactSharing='none'", async () => {
      const respondent = await createActiveRecipient();
      const submitted = await submitResponse(requestId, respondent.id, {
        relevanceStatement: "Relevant.",
        answerText: "Svar.",
        contactSharing: "none",
      });
      if (!submitted.ok) throw new Error("fail submit");

      const result = await getResponseDetailForJournalist(submitted.id, journalistId);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.sharedEmail).toBeNull();
    });

    it("contactRequest er null når svaret ikke har noen tilknyttet kontaktforespørsel (SPEC-V1.md 13, 'tidslinje for handlinger')", async () => {
      const respondent = await createActiveRecipient();
      const submitted = await submitResponse(requestId, respondent.id, {
        relevanceStatement: "Relevant.",
        answerText: "Svar.",
        contactSharing: "none",
      });
      if (!submitted.ok) throw new Error("fail submit");

      const result = await getResponseDetailForJournalist(submitted.id, journalistId);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.contactRequest).toBeNull();
    });

    it("contactRequest gjenspeiler den faktiske raden når en kontaktforespørsel finnes (SPEC-V1.md 13, 'tidslinje for handlinger')", async () => {
      const respondent = await createActiveRecipient();
      const submitted = await submitResponse(requestId, respondent.id, {
        relevanceStatement: "Relevant.",
        answerText: "Svar.",
        contactSharing: "none",
      });
      if (!submitted.ok) throw new Error("fail submit");
      const created = await createContactRequest(submitted.id, journalistId, {
        message: "Kan jeg få vite mer?",
        requestedContactMethod: "e-post",
      });
      if (!created.ok) throw new Error("fail create contact request");

      const result = await getResponseDetailForJournalist(submitted.id, journalistId);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.contactRequest?.status).toBe("pending");
      expect(result.data.contactRequest?.respondedAt).toBeNull();
      expect(result.data.contactRequest?.createdAt).toBeTruthy();
      expect(result.data.contactRequest?.expiresAt).toBeTruthy();
    });
  });

  describe("updateResponseMarking", () => {
    it("returnerer errors.not_found for et svar som tilhører en ANNEN journalists forespørsel", async () => {
      const otherJournalist = await createActiveJournalist();
      const respondent = await createActiveRecipient();
      const submitted = await submitResponse(requestId, respondent.id, {
        relevanceStatement: "Relevant.",
        answerText: "Svar.",
        contactSharing: "none",
      });
      if (!submitted.ok) throw new Error("fail submit");

      const result = await updateResponseMarking(submitted.id, otherJournalist.id, {
        marking: "shortlisted",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("errors.not_found");
    });

    it("setter journalistMarking og journalistNote, men rører ALDRI lifecycleStatus (19.7)", async () => {
      const respondent = await createActiveRecipient();
      const submitted = await submitResponse(requestId, respondent.id, {
        relevanceStatement: "Relevant.",
        answerText: "Svar.",
        contactSharing: "none",
      });
      if (!submitted.ok) throw new Error("fail submit");

      const result = await updateResponseMarking(submitted.id, journalistId, {
        marking: "not_selected",
        note: "En intern notis.",
      });

      expect(result.ok).toBe(true);
      const [row] = await db.select().from(responses).where(eq(responses.id, submitted.id));
      expect(row?.journalistMarking).toBe("not_selected");
      expect(row?.journalistNote).toBe("En intern notis.");
      expect(row?.lifecycleStatus).toBe("submitted");
    });

    it("er et no-op når verken marking eller note er oppgitt", async () => {
      const respondent = await createActiveRecipient();
      const submitted = await submitResponse(requestId, respondent.id, {
        relevanceStatement: "Relevant.",
        answerText: "Svar.",
        contactSharing: "none",
      });
      if (!submitted.ok) throw new Error("fail submit");

      const result = await updateResponseMarking(submitted.id, journalistId, {});

      expect(result).toEqual({ ok: true, data: null });
      const [row] = await db.select().from(responses).where(eq(responses.id, submitted.id));
      expect(row?.journalistMarking).toBe("unreviewed");
    });
  });
});
