import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  digestDeliveries,
  digests,
  emailSubscriptions,
  journalistProfiles,
  moderatorCountries,
  requests,
  users,
} from "@/db/schema";
import {
  createActiveJournalist,
  ensureSecondTestCountry,
  ensureTestCountry,
  TEST_COUNTRY_CODE,
  TEST_COUNTRY_CODE_2,
  uniqueTestEmail,
} from "@/db/integration/fixtures";
import { hashToken, generateToken } from "@/lib/auth/tokens";
import type { CurrentSession } from "@/lib/auth/session";
import { getDashboardCountries, getDashboardStatsForCountry } from "./dashboard";

// getDashboardStatsForCountry() tar landkoden direkte og getDashboardCountries()
// tar en allerede utledet CurrentSession (samme mønster som
// listModerationQueue() i moderation/requests.ts) — ingen av dem kaller
// getCurrentSession() selv, så INGEN vi.mock("next/headers") trengs her,
// ulikt de session-avhengige admin-/moderation-funksjonene testet tidligere
// denne økten.

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

describe("getDashboardStatsForCountry mot ekte Postgres (SPEC-V1.md 16.1)", () => {
  it("teller ventende journalistsøknader for landet, ikke godkjente/avviste eller andre lands", async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
    const journalist = await createActiveJournalist();

    const [otherCountryJournalist] = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("journalist-other-country"),
        role: "journalist",
        status: "active",
        countryCode: TEST_COUNTRY_CODE_2,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    await db.insert(journalistProfiles).values({
      userId: otherCountryJournalist!.id,
      fullName: "Annet Land Journalist",
      jobTitle: "Journalist",
      organizationName: "Testavisen",
      organizationUrl: "https://example.invalid",
      verificationStatus: "pending_review",
    });

    // Målt som DELTA, ikke absolutt tall — TEST_COUNTRY_CODE er delt med
    // mange andre integrasjonstestfiler som (bevisst, se fixtures.ts) ikke
    // rydder opp i alle rader de oppretter, så en absolutt "skal være 0"
    // ville vært skjørt mot rekkefølgen testfiler kjører i.
    const before = await getDashboardStatsForCountry(TEST_COUNTRY_CODE);
    // journalist (fixturen) er allerede "approved" — teller ikke, endrer ikke tallet.
    const afterFixtureJournalist = await getDashboardStatsForCountry(TEST_COUNTRY_CODE);
    expect(afterFixtureJournalist.pendingJournalistApplications).toBe(
      before.pendingJournalistApplications
    );

    await db
      .update(journalistProfiles)
      .set({ verificationStatus: "pending_review" })
      .where(eq(journalistProfiles.userId, journalist.id));

    const after = await getDashboardStatsForCountry(TEST_COUNTRY_CODE);
    expect(after.pendingJournalistApplications).toBe(before.pendingJournalistApplications + 1);

    const otherCountryStats = await getDashboardStatsForCountry(TEST_COUNTRY_CODE_2);
    expect(otherCountryStats.pendingJournalistApplications).toBeGreaterThanOrEqual(1);
  });

  it("teller forespørsler i modereringskø og aktive (publiserte) forespørsler separat", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();

    await db.insert(requests).values([
      {
        journalistId: journalist.id,
        countryCode: TEST_COUNTRY_CODE,
        contentLanguage: "nb-NO",
        title: "Dashbord-test i kø",
        summary: "Sum",
        description: "Desc",
        targetPersonDescription: "Target",
        status: "submitted",
        allowsAnonymousParticipation: true,
        mayBeRecorded: false,
        mayInvolvePhotoVideo: false,
        responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      {
        journalistId: journalist.id,
        countryCode: TEST_COUNTRY_CODE,
        contentLanguage: "nb-NO",
        title: "Dashbord-test aktiv",
        summary: "Sum",
        description: "Desc",
        targetPersonDescription: "Target",
        status: "published",
        allowsAnonymousParticipation: true,
        mayBeRecorded: false,
        mayInvolvePhotoVideo: false,
        responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        publishedAt: new Date(),
      },
    ]);

    const stats = await getDashboardStatsForCountry(TEST_COUNTRY_CODE);
    expect(stats.moderationQueueCount).toBeGreaterThanOrEqual(1);
    expect(stats.activeRequestsCount).toBeGreaterThanOrEqual(1);

    await db.delete(requests).where(eq(requests.journalistId, journalist.id));
  });

  it("teller kun publiserte forespørsler med frist innen 48 timer som 'utløper snart'", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();

    await db.insert(requests).values([
      {
        journalistId: journalist.id,
        countryCode: TEST_COUNTRY_CODE,
        contentLanguage: "nb-NO",
        title: "Dashbord-test utløper snart",
        summary: "Sum",
        description: "Desc",
        targetPersonDescription: "Target",
        status: "published",
        allowsAnonymousParticipation: true,
        mayBeRecorded: false,
        mayInvolvePhotoVideo: false,
        responseDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        publishedAt: new Date(),
      },
      {
        journalistId: journalist.id,
        countryCode: TEST_COUNTRY_CODE,
        contentLanguage: "nb-NO",
        title: "Dashbord-test langt frem",
        summary: "Sum",
        description: "Desc",
        targetPersonDescription: "Target",
        status: "published",
        allowsAnonymousParticipation: true,
        mayBeRecorded: false,
        mayInvolvePhotoVideo: false,
        responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        publishedAt: new Date(),
      },
    ]);

    const stats = await getDashboardStatsForCountry(TEST_COUNTRY_CODE);
    expect(stats.expiringSoonCount).toBeGreaterThanOrEqual(1);

    await db.delete(requests).where(eq(requests.journalistId, journalist.id));
  });

  it("teller nye mottakere og avmeldinger siste 7 dager, ikke eldre", async () => {
    await ensureTestCountry();

    const [newRecipient] = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("new-recipient"),
        role: "recipient",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });

    const [oldRecipient] = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("old-recipient"),
        role: "recipient",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      })
      .returning({ id: users.id });

    await db.insert(emailSubscriptions).values({
      userId: newRecipient!.id,
      status: "unsubscribed",
      unsubscribedAt: new Date(),
      unsubscribeTokenHash: hashToken(generateToken()),
    });
    await db.insert(emailSubscriptions).values({
      userId: oldRecipient!.id,
      status: "unsubscribed",
      unsubscribedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      unsubscribeTokenHash: hashToken(generateToken()),
    });

    const stats = await getDashboardStatsForCountry(TEST_COUNTRY_CODE);
    expect(stats.newRecipientsLast7Days).toBeGreaterThanOrEqual(1);
    expect(stats.unsubscribesLast7Days).toBeGreaterThanOrEqual(1);
  });

  it("returnerer null for siste utsendelse når ingen digest er kjørt for landet ennå", async () => {
    await ensureSecondTestCountry();
    const stats = await getDashboardStatsForCountry(TEST_COUNTRY_CODE_2);
    expect(stats.lastDigest).toBeNull();
  });

  it("returnerer siste utsendelse med antall feilede leveranser", async () => {
    await ensureTestCountry();
    const [digest] = await db
      .insert(digests)
      .values({
        countryCode: TEST_COUNTRY_CODE,
        scheduledFor: "2026-07-30",
        requestIds: [],
        recipientCount: 3,
        status: "sent",
        sentAt: new Date(),
      })
      .returning({ id: digests.id });

    const recipient1 = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("digest-recipient-1"),
        role: "recipient",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    const recipient2 = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("digest-recipient-2"),
        role: "recipient",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });

    await db.insert(digestDeliveries).values([
      {
        digestId: digest!.id,
        userId: recipient1[0]!.id,
        locale: "nb-NO",
        accessTokenHash: hashToken(generateToken()),
        status: "delivered",
      },
      {
        digestId: digest!.id,
        userId: recipient2[0]!.id,
        locale: "nb-NO",
        accessTokenHash: hashToken(generateToken()),
        status: "failed",
        errorMessage: "Test-feil.",
      },
    ]);

    const stats = await getDashboardStatsForCountry(TEST_COUNTRY_CODE);
    expect(stats.lastDigest).toEqual({
      scheduledFor: "2026-07-30",
      status: "sent",
      recipientCount: 3,
      failedDeliveryCount: 1,
    });

    await db.delete(digestDeliveries).where(eq(digestDeliveries.digestId, digest!.id));
    await db.delete(digests).where(eq(digests.id, digest!.id));
  });
});

describe("getDashboardCountries mot ekte Postgres", () => {
  it("en administrator uten valgt land får en TOM liste (venter på et valg via velgeren)", async () => {
    const countries = await getDashboardCountries(makeSession({ role: "admin" }));
    expect(countries).toEqual([]);
  });

  it("en administrator MED valgt land får nøyaktig det landet", async () => {
    const countries = await getDashboardCountries(makeSession({ role: "admin" }), TEST_COUNTRY_CODE_2);
    expect(countries).toEqual([TEST_COUNTRY_CODE_2]);
  });

  it("en moderator får sine tildelte land, uansett selectedCountryCode (ingen velger for moderator)", async () => {
    await ensureTestCountry();
    const [moderator] = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("dashboard-moderator"),
        role: "moderator",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    await db.insert(moderatorCountries).values({
      moderatorUserId: moderator!.id,
      countryCode: TEST_COUNTRY_CODE,
    });

    const countries = await getDashboardCountries(
      makeSession({ role: "moderator", userId: moderator!.id }),
      "ET-ANNET-LAND"
    );

    expect(countries).toEqual([TEST_COUNTRY_CODE]);
  });

  it("en moderator uten tildelte land får en tom liste", async () => {
    await ensureTestCountry();
    const [moderator] = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("dashboard-unassigned-moderator"),
        role: "moderator",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });

    const countries = await getDashboardCountries(makeSession({ role: "moderator", userId: moderator!.id }));

    expect(countries).toEqual([]);
  });
});
