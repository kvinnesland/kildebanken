import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { requests, users } from "@/db/schema";
import { createActiveJournalist, ensureTestCountry, TEST_COUNTRY_CODE } from "@/db/integration/fixtures";
import { getPublicRequest } from "./requests";

describe("getPublicRequest mot ekte Postgres", () => {
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
        title: "Synlighetstest",
        summary: "En testforespørsel for synlighetsregelen.",
        description: "Full beskrivelse.",
        targetPersonDescription: "Hvem som helst.",
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
    await db.delete(requests).where(eq(requests.id, requestId));
  });

  it("er offentlig synlig så lenge journalisten er aktiv", async () => {
    const found = await getPublicRequest(requestId);
    expect(found?.id).toBe(requestId);
  });

  it("skjules umiddelbart når eierens konto suspenderes, og vises igjen når den gjenopprettes (8.1)", async () => {
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, journalistId));
    const hidden = await getPublicRequest(requestId);
    expect(hidden).toBeNull();

    await db.update(users).set({ status: "active" }).where(eq(users.id, journalistId));
    const visibleAgain = await getPublicRequest(requestId);
    expect(visibleAgain?.id).toBe(requestId);
  });
});
