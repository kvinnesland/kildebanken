import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { requests, responses } from "@/db/schema";
import {
  createActiveJournalist,
  createActiveRecipient,
  ensureTestCountry,
  TEST_COUNTRY_CODE,
} from "@/db/integration/fixtures";
import { submitResponse, withdrawResponse } from "./responses";

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
