import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { authTokens, consentRecords, journalistProfiles, suppressions, users } from "@/db/schema";
import { ensureTestCountry, TEST_COUNTRY_CODE, uniqueTestEmail } from "@/db/integration/fixtures";
import { hashToken } from "@/lib/auth/tokens";
import { applyAsJournalist, type ApplyAsJournalistInput } from "./journalist";

function input(overrides: Partial<ApplyAsJournalistInput> = {}): ApplyAsJournalistInput {
  return {
    fullName: "Test Journalist",
    jobEmail: uniqueTestEmail("journalist-apply"),
    jobTitle: "Journalist",
    organizationName: "Testavisen",
    organizationUrl: "https://example.invalid",
    countryCode: TEST_COUNTRY_CODE,
    locale: "nb-NO",
    consentJournalistTerms: true,
    ...overrides,
  };
}

describe("applyAsJournalist mot ekte Postgres (SPEC-V1.md 7.2/8.1)", () => {
  const createdEmails: string[] = [];

  beforeAll(async () => {
    await ensureTestCountry();
  });

  afterAll(async () => {
    for (const email of createdEmails) {
      const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
      if (user) {
        // applyAsJournalist() kaller requestMagicLink() til slutt, som setter
        // inn en auth_tokens-rad — samme FK-rekkefølge-lærdom som
        // recipient.integration.test.ts.
        await db.delete(authTokens).where(eq(authTokens.userId, user.id));
        await db.delete(consentRecords).where(eq(consentRecords.userId, user.id));
        await db.delete(journalistProfiles).where(eq(journalistProfiles.userId, user.id));
        await db.delete(users).where(eq(users.id, user.id));
      }
    }
  });

  it("avviser uten samtykke til journalistvilkårene", async () => {
    const result = await applyAsJournalist(input({ consentJournalistTerms: false }));

    expect(result).toEqual({ ok: false, error: "errors.consent_required" });
  });

  it("oppretter bruker (pending_email_verification), profil (pending_review) og ETT samtykke", async () => {
    const email = uniqueTestEmail("journalist-apply");
    createdEmails.push(email);

    const result = await applyAsJournalist(input({ jobEmail: email }));

    expect(result.ok).toBe(true);

    const [user] = await db.select().from(users).where(eq(users.email, email));
    expect(user?.status).toBe("pending_email_verification");
    expect(user?.role).toBe("journalist");

    const [profile] = await db
      .select()
      .from(journalistProfiles)
      .where(eq(journalistProfiles.userId, user!.id));
    expect(profile?.verificationStatus).toBe("pending_review");

    const consents = await db.select().from(consentRecords).where(eq(consentRecords.userId, user!.id));
    expect(consents).toHaveLength(1);
    expect(consents[0]?.consentType).toBe("journalist_terms");
    expect(consents[0]?.granted).toBe(true);
  });

  it("avviser andre søknad med SAMME e-post (race-beskyttelsen, ikke bare forhåndssjekken)", async () => {
    const email = uniqueTestEmail("journalist-duplicate");
    createdEmails.push(email);
    const applyInput = input({ jobEmail: email });

    const first = await applyAsJournalist(applyInput);
    expect(first.ok).toBe(true);

    const second = await applyAsJournalist(applyInput);
    expect(second).toEqual({ ok: false, error: "errors.email_already_registered" });

    const allUsers = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    expect(allUsers).toHaveLength(1);
  });

  it("avviser en søknad med en e-post som står på sperrelisten (10.3/19.13 — rolleuavhengig)", async () => {
    const email = uniqueTestEmail("journalist-suppressed");
    // Bevisst IKKE lagt til createdEmails — skal ikke opprettes i det hele tatt.
    await db.insert(suppressions).values({ emailHash: hashToken(email), reason: "complaint" });

    const result = await applyAsJournalist(input({ jobEmail: email }));

    expect(result).toEqual({ ok: false, error: "errors.email_suppressed" });
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    expect(user).toBeUndefined();

    await db.delete(suppressions).where(eq(suppressions.emailHash, hashToken(email)));
  });

  it("avviser et land som ikke er active", async () => {
    const result = await applyAsJournalist(input({ countryCode: "ZZ" }));

    expect(result).toEqual({ ok: false, error: "errors.invalid_country" });
  });

  it("avviser en locale landet ikke tilbyr", async () => {
    const result = await applyAsJournalist(input({ locale: "fr-FR" }));

    expect(result).toEqual({ ok: false, error: "errors.invalid_locale" });
  });
});
