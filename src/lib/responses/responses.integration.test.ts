import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { contactRequests, requests, responses } from "@/db/schema";
import {
  createActiveJournalist,
  createActiveRecipient,
  ensureTestCountry,
  TEST_COUNTRY_CODE,
} from "@/db/integration/fixtures";
import { listMineResponses, submitResponse, withdrawResponse } from "./responses";

// Første gang i natt et av disse invariantene faktisk kjøres mot en ekte
// Postgres, ikke bare leses i migrasjons-SQL-en. Se NATTLOGG.md, økt 7.
describe("submitResponse / withdrawResponse mot ekte Postgres", () => {
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
        title: "Testforespørsel",
        summary: "En testforespørsel for integrasjonstest.",
        description: "Full beskrivelse.",
        targetPersonDescription: "Hvem som helst til testen.",
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
    await db.delete(responses).where(eq(responses.requestId, requestId));
    await db.delete(requests).where(eq(requests.id, requestId));
  });

  it("tillater ett svar fra en respondent", async () => {
    const respondent = await createActiveRecipient();
    const result = await submitResponse(requestId, respondent.id, {
      relevanceStatement: "Jeg er relevant fordi X.",
      answerText: "Svaret mitt på spørsmålet.",
      contactSharing: "none",
    });

    expect(result.ok).toBe(true);
  });

  it("FR-041: avviser et andre svar fra SAMME respondent på SAMME forespørsel — håndhevet av Postgres, ikke bare applikasjonskode", async () => {
    const respondent = await createActiveRecipient();

    const first = await submitResponse(requestId, respondent.id, {
      relevanceStatement: "Første svar.",
      answerText: "Svar.",
      contactSharing: "none",
    });
    expect(first.ok).toBe(true);

    const second = await submitResponse(requestId, respondent.id, {
      relevanceStatement: "Forsøk på et andre svar.",
      answerText: "Svar igjen.",
      contactSharing: "none",
    });

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe("errors.already_responded");
  });

  it("tillater et NYTT svar etter at det forrige er trukket (FR-041 er per AKTIVT svar, ikke for alltid)", async () => {
    const respondent = await createActiveRecipient();

    const first = await submitResponse(requestId, respondent.id, {
      relevanceStatement: "Første svar.",
      answerText: "Svar.",
      contactSharing: "none",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const withdrawal = await withdrawResponse(first.id, respondent.id);
    expect(withdrawal.ok).toBe(true);

    // 17.4: trukket svar slettes umiddelbart — bekreft at raden faktisk er
    // borte, ikke bare markert.
    const stillThere = await db
      .select({ id: responses.id })
      .from(responses)
      .where(eq(responses.id, first.id));
    expect(stillThere).toHaveLength(0);

    const second = await submitResponse(requestId, respondent.id, {
      relevanceStatement: "Nytt svar etter trekking.",
      answerText: "Nytt svar.",
      contactSharing: "none",
    });
    expect(second.ok).toBe(true);
  });
});

describe("submitResponse — hastighetsgrense (SPEC-V1.md 18: 10 svar per konto per time)", () => {
  it("avviser det 11. svaret innen samme time, med errors.rate_limited", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const respondent = await createActiveRecipient();

    const requestIds: string[] = [];
    for (let i = 0; i < 11; i++) {
      const [request] = await db
        .insert(requests)
        .values({
          journalistId: journalist.id,
          countryCode: TEST_COUNTRY_CODE,
          contentLanguage: "nb-NO",
          title: `Testforespørsel ${i}`,
          summary: "En testforespørsel for hastighetsgrense-test.",
          description: "Full beskrivelse.",
          targetPersonDescription: "Hvem som helst til testen.",
          responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: "published",
          allowsAnonymousParticipation: true,
          mayBeRecorded: false,
          mayInvolvePhotoVideo: false,
          publishedAt: new Date(),
        })
        .returning({ id: requests.id });
      if (!request) throw new Error("Klarte ikke opprette testforespørsel");
      requestIds.push(request.id);
    }

    try {
      for (let i = 0; i < 10; i++) {
        const result = await submitResponse(requestIds[i]!, respondent.id, {
          relevanceStatement: `Svar ${i}.`,
          answerText: "Svaret mitt.",
          contactSharing: "none",
        });
        expect(result.ok).toBe(true);
      }

      const eleventh = await submitResponse(requestIds[10]!, respondent.id, {
        relevanceStatement: "Det 11. svaret.",
        answerText: "Skal avvises.",
        contactSharing: "none",
      });

      expect(eleventh.ok).toBe(false);
      if (!eleventh.ok) expect(eleventh.error).toBe("errors.rate_limited");
    } finally {
      await db.delete(responses).where(inArray(responses.requestId, requestIds));
      await db.delete(requests).where(inArray(requests.id, requestIds));
    }
  });
});

describe("listMineResponses mot ekte Postgres — utledet displayStatus (SPEC-V1.md 12.6)", () => {
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
        title: "Testforespørsel for svarliste",
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

  it("prioriterer not_selected over contact_requested/viewed når flere er sanne samtidig", async () => {
    const respondent = await createActiveRecipient();
    const submitted = await submitResponse(requestId, respondent.id, {
      relevanceStatement: "Relevant.",
      answerText: "Svar.",
      contactSharing: "none",
    });
    if (!submitted.ok) throw new Error("fail submit");

    await db
      .update(responses)
      .set({ viewedAt: new Date(), journalistMarking: "not_selected" })
      .where(eq(responses.id, submitted.id));
    await db.insert(contactRequests).values({
      responseId: submitted.id,
      journalistId,
      message: "Kan jeg få vite mer?",
      requestedContactMethod: "e-post",
      status: "pending",
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    const mine = await listMineResponses(respondent.id);
    const item = mine.find((r) => r.id === submitted.id);
    expect(item?.displayStatus).toBe("not_selected");
    expect(item?.canWithdraw).toBe(true);
  });

  it("viser contact_requested når en kontaktforespørsel finnes, men ingen not_selected-markering", async () => {
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
      status: "pending",
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    const mine = await listMineResponses(respondent.id);
    const item = mine.find((r) => r.id === submitted.id);
    expect(item?.displayStatus).toBe("contact_requested");
  });

  it("viser viewed når svaret er sett, men ingen kontaktforespørsel/markering finnes", async () => {
    const respondent = await createActiveRecipient();
    const submitted = await submitResponse(requestId, respondent.id, {
      relevanceStatement: "Relevant.",
      answerText: "Svar.",
      contactSharing: "none",
    });
    if (!submitted.ok) throw new Error("fail submit");

    await db.update(responses).set({ viewedAt: new Date() }).where(eq(responses.id, submitted.id));

    const mine = await listMineResponses(respondent.id);
    const item = mine.find((r) => r.id === submitted.id);
    expect(item?.displayStatus).toBe("viewed");
  });

  it("viser submitted som standard, og canWithdraw=false når forespørselen ikke lenger er published", async () => {
    const respondent = await createActiveRecipient();
    const submitted = await submitResponse(requestId, respondent.id, {
      relevanceStatement: "Relevant.",
      answerText: "Svar.",
      contactSharing: "none",
    });
    if (!submitted.ok) throw new Error("fail submit");

    let mine = await listMineResponses(respondent.id);
    expect(mine.find((r) => r.id === submitted.id)?.displayStatus).toBe("submitted");

    await db.update(requests).set({ status: "closed" }).where(eq(requests.id, requestId));
    mine = await listMineResponses(respondent.id);
    expect(mine.find((r) => r.id === submitted.id)?.canWithdraw).toBe(false);

    await db.update(requests).set({ status: "published" }).where(eq(requests.id, requestId));
  });
});
