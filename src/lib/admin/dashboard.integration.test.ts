import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  countries,
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
    displayName: null,
    ...overrides,
  };
}

describe("getDashboardStatsForCountry mot ekte Postgres (SPEC-V1.md 16.1)", () => {
  it("teller ventende journalistsøknader for landet, ikke godkjente/avviste eller andre lands", async () => {
    // To EGNE, isolerte testland i stedet for TEST_COUNTRY_CODE/_2 — en
    // eksakt før/etter-delta på et delt land er iboende skjørt: enhver
    // parallell fil som (helt legitimt) oppretter en `pending_review`-
    // journalistprofil for samme land i vinduet mellom de to lesningene
    // endrer delta-en (dette slo faktisk til, se NATTLOGG.md —
    // `registration/journalist.integration.test.ts` gjør nøyaktig dette).
    // Et par land bare denne testen vet om gjør delta-en eksakt uten unntak.
    const ownCountry = `Z${randomUUID().slice(0, 6).toUpperCase()}`;
    const otherCountry = `Z${randomUUID().slice(0, 6).toUpperCase()}`;
    await db.insert(countries).values([
      {
        code: ownCountry,
        nameKey: "country.test.name",
        defaultLocale: "nb-NO",
        availableLocales: ["nb-NO"],
        timezone: "Europe/Oslo",
        minimumAge: 18,
        digestSendTime: "07:00",
        senderNameKey: "email.sender_name.test",
        supportEmail: "test@example.invalid",
        status: "active",
      },
      {
        code: otherCountry,
        nameKey: "country.test.name",
        defaultLocale: "nb-NO",
        availableLocales: ["nb-NO"],
        timezone: "Europe/Oslo",
        minimumAge: 18,
        digestSendTime: "07:00",
        senderNameKey: "email.sender_name.test",
        supportEmail: "test@example.invalid",
        status: "active",
      },
    ]);

    try {
      const [approvedJournalist] = await db
        .insert(users)
        .values({
          email: uniqueTestEmail("journalist-own-country"),
          role: "journalist",
          status: "active",
          countryCode: ownCountry,
          locale: "nb-NO",
          emailVerifiedAt: new Date(),
        })
        .returning({ id: users.id });
      await db.insert(journalistProfiles).values({
        userId: approvedJournalist!.id,
        fullName: "Godkjent Journalist",
        jobTitle: "Journalist",
        organizationName: "Testavisen",
        organizationUrl: "https://example.invalid",
        verificationStatus: "approved",
      });

      const [otherCountryJournalist] = await db
        .insert(users)
        .values({
          email: uniqueTestEmail("journalist-other-country"),
          role: "journalist",
          status: "active",
          countryCode: otherCountry,
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

      const before = await getDashboardStatsForCountry(ownCountry);
      expect(before.pendingJournalistApplications).toBe(0);

      await db
        .update(journalistProfiles)
        .set({ verificationStatus: "pending_review" })
        .where(eq(journalistProfiles.userId, approvedJournalist!.id));

      const after = await getDashboardStatsForCountry(ownCountry);
      expect(after.pendingJournalistApplications).toBe(1);

      const otherCountryStats = await getDashboardStatsForCountry(otherCountry);
      expect(otherCountryStats.pendingJournalistApplications).toBe(1);
    } finally {
      await db.delete(journalistProfiles).where(
        inArray(
          journalistProfiles.userId,
          db.select({ id: users.id }).from(users).where(inArray(users.countryCode, [ownCountry, otherCountry]))
        )
      );
      await db.delete(users).where(inArray(users.countryCode, [ownCountry, otherCountry]));
      await db.delete(countries).where(inArray(countries.code, [ownCountry, otherCountry]));
    }
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
    // Eget, ISOLERT testland i stedet for TEST_COUNTRY_CODE — "siste
    // utsendelse" plukkes med `orderBy(desc(scheduled_for))` (dashboard.ts),
    // så en delt landkode ville gjort denne testen avhengig av at INGEN
    // annen parallell fil (f.eks. digests.integration.test.ts, som også
    // setter inn digest-rader for TEST_COUNTRY_CODE med tilfeldige
    // fremtidsdatoer) tilfeldigvis har en nyere dato akkurat når
    // getDashboardStatsForCountry() kalles. Et land bare denne testen vet om
    // gjør den fullstendig immun mot det, samme klasse fiks som isolasjonen i
    // legal/documents.integration.test.ts. `try/finally` sikrer i tillegg at
    // opprydding kjører selv om en assertion feiler — en hardkodet
    // scheduledFor-dato kolliderte tidligere permanent med en rad en
    // mislykket kjøring lot stå igjen (ryddingen nådde aldri dit), se
    // NATTLOGG.md.
    const countryCode = `Z${randomUUID().slice(0, 6).toUpperCase()}`;
    await db.insert(countries).values({
      code: countryCode,
      nameKey: "country.test.name",
      defaultLocale: "nb-NO",
      availableLocales: ["nb-NO"],
      timezone: "Europe/Oslo",
      minimumAge: 18,
      digestSendTime: "07:00",
      senderNameKey: "email.sender_name.test",
      supportEmail: "test@example.invalid",
      status: "active",
    });

    try {
      const [digest] = await db
        .insert(digests)
        .values({
          countryCode,
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
          countryCode,
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
          countryCode,
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

      const stats = await getDashboardStatsForCountry(countryCode);
      expect(stats.lastDigest).toEqual({
        scheduledFor: "2026-07-30",
        status: "sent",
        recipientCount: 3,
        failedDeliveryCount: 1,
      });
    } finally {
      const digestIdsForCountry = db
        .select({ id: digests.id })
        .from(digests)
        .where(eq(digests.countryCode, countryCode));
      await db.delete(digestDeliveries).where(inArray(digestDeliveries.digestId, digestIdsForCountry));
      await db.delete(digests).where(eq(digests.countryCode, countryCode));
      await db.delete(users).where(eq(users.countryCode, countryCode));
      await db.delete(countries).where(eq(countries.code, countryCode));
    }
  });
});

describe("getDashboardCountries mot ekte Postgres", () => {
  // Reelt hull frem til nå (se NATTLOGG.md): de to moderatorene testene
  // under oppretter ble aldri ryddet bort. Ryddes samlet i afterAll
  // nederst i denne blokken.
  const createdModeratorIds: string[] = [];

  afterAll(async () => {
    if (createdModeratorIds.length === 0) return;
    await db.delete(moderatorCountries).where(inArray(moderatorCountries.moderatorUserId, createdModeratorIds));
    await db.delete(users).where(inArray(users.id, createdModeratorIds));
  });

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
    if (moderator) createdModeratorIds.push(moderator.id);
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
    if (moderator) createdModeratorIds.push(moderator.id);

    const countries = await getDashboardCountries(makeSession({ role: "moderator", userId: moderator!.id }));

    expect(countries).toEqual([]);
  });
});
