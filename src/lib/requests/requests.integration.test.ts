import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, moderatorCountries, requests, users } from "@/db/schema";
import {
  createActiveJournalist,
  ensureSecondTestCountry,
  ensureTestCountry,
  TEST_COUNTRY_CODE,
  TEST_COUNTRY_CODE_2,
  uniqueTestEmail,
} from "@/db/integration/fixtures";
import { closeRequest, getPublicRequest } from "./requests";

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

describe("closeRequest mot ekte Postgres — moderator er begrenset til tildelt land (4)", () => {
  let journalistId: string;
  let requestId: string;
  let moderatorOtherCountryId: string;
  let moderatorSameCountryId: string;

  beforeAll(async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();

    const journalist = await createActiveJournalist();
    journalistId = journalist.id;

    const [request] = await db
      .insert(requests)
      .values({
        journalistId,
        countryCode: TEST_COUNTRY_CODE,
        contentLanguage: "nb-NO",
        title: "Lukketest",
        summary: "En testforespørsel for lukkeautorisasjon.",
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

    const [moderatorOtherCountry] = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("moderator-other-country"),
        role: "moderator",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    if (!moderatorOtherCountry) throw new Error("Klarte ikke opprette testmoderator");
    moderatorOtherCountryId = moderatorOtherCountry.id;
    await db
      .insert(moderatorCountries)
      .values({ moderatorUserId: moderatorOtherCountryId, countryCode: TEST_COUNTRY_CODE_2 });

    const [moderatorSameCountry] = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("moderator-same-country"),
        role: "moderator",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    if (!moderatorSameCountry) throw new Error("Klarte ikke opprette testmoderator");
    moderatorSameCountryId = moderatorSameCountry.id;
    await db
      .insert(moderatorCountries)
      .values({ moderatorUserId: moderatorSameCountryId, countryCode: TEST_COUNTRY_CODE });
  });

  afterAll(async () => {
    await db.delete(auditLogs).where(eq(auditLogs.entityId, requestId));
    await db.delete(moderatorCountries).where(eq(moderatorCountries.moderatorUserId, moderatorOtherCountryId));
    await db.delete(moderatorCountries).where(eq(moderatorCountries.moderatorUserId, moderatorSameCountryId));
    await db.delete(users).where(eq(users.id, moderatorOtherCountryId));
    await db.delete(users).where(eq(users.id, moderatorSameCountryId));
    await db.delete(requests).where(eq(requests.id, requestId));
  });

  it("nekter en moderator som IKKE er tildelt forespørselens land å lukke den", async () => {
    const result = await closeRequest(requestId, moderatorOtherCountryId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("errors.not_authorized");

    const [row] = await db.select({ status: requests.status }).from(requests).where(eq(requests.id, requestId));
    expect(row?.status).toBe("published");
  });

  it("lar en moderator tildelt SAMME land lukke forespørselen, og logger handlingen (FR-050)", async () => {
    const result = await closeRequest(requestId, moderatorSameCountryId);
    expect(result.ok).toBe(true);

    const [row] = await db.select({ status: requests.status }).from(requests).where(eq(requests.id, requestId));
    expect(row?.status).toBe("closed");

    const [log] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, requestId), eq(auditLogs.action, "request.close")));
    expect(log?.actorUserId).toBe(moderatorSameCountryId);
    expect(log?.countryCode).toBe(TEST_COUNTRY_CODE);
  });
});
