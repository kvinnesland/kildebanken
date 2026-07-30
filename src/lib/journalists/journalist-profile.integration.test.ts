import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { journalistProfiles, users } from "@/db/schema";
import { ensureTestCountry, TEST_COUNTRY_CODE, uniqueTestEmail } from "@/db/integration/fixtures";
import { getJournalistProfile, updateJournalistProfile } from "./journalist-profile";

async function createJournalistWithProfile(): Promise<{ id: string }> {
  const [user] = await db
    .insert(users)
    .values({
      email: uniqueTestEmail("journalist-profile"),
      role: "journalist",
      status: "active",
      countryCode: TEST_COUNTRY_CODE,
      locale: "nb-NO",
      emailVerifiedAt: new Date(),
    })
    .returning({ id: users.id });
  if (!user) throw new Error("Kunne ikke opprette test-journalist");

  await db.insert(journalistProfiles).values({
    userId: user.id,
    fullName: "Opprinnelig Navn",
    jobTitle: "Journalist",
    organizationName: "Testavisen",
    organizationUrl: "https://example.invalid",
  });

  return { id: user.id };
}

describe("journalist-profile mot ekte Postgres", () => {
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    await ensureTestCountry();
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.delete(journalistProfiles).where(eq(journalistProfiles.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
    }
  });

  it("henter profilen med land/locale fra User og felter fra JournalistProfile", async () => {
    const journalist = await createJournalistWithProfile();
    createdUserIds.push(journalist.id);

    const profile = await getJournalistProfile(journalist.id);
    expect(profile).toEqual({
      fullName: "Opprinnelig Navn",
      jobTitle: "Journalist",
      organizationName: "Testavisen",
      organizationUrl: "https://example.invalid",
      verificationStatus: "pending_review",
      countryCode: TEST_COUNTRY_CODE,
      locale: "nb-NO",
    });
  });

  it("oppdaterer kontaktfelt uten å røre verification_status", async () => {
    const journalist = await createJournalistWithProfile();
    createdUserIds.push(journalist.id);

    const result = await updateJournalistProfile(journalist.id, {
      jobTitle: "Ny stilling",
      organizationUrl: "https://ny-adresse.invalid",
    });
    expect(result.ok).toBe(true);

    const profile = await getJournalistProfile(journalist.id);
    expect(profile?.jobTitle).toBe("Ny stilling");
    expect(profile?.organizationUrl).toBe("https://ny-adresse.invalid");
    expect(profile?.fullName).toBe("Opprinnelig Navn");
    expect(profile?.verificationStatus).toBe("pending_review");
  });

  it("avviser tomme felt", async () => {
    const journalist = await createJournalistWithProfile();
    createdUserIds.push(journalist.id);

    const result = await updateJournalistProfile(journalist.id, { fullName: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("errors.validation_failed");
  });
});
