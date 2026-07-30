import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { authTokens, consentRecords, emailSubscriptions, users } from "@/db/schema";
import { ensureTestCountry, TEST_COUNTRY_CODE, uniqueTestEmail } from "@/db/integration/fixtures";
import { registerRecipient } from "./recipient";

describe("registerRecipient mot ekte Postgres", () => {
  const createdEmails: string[] = [];

  beforeAll(async () => {
    await ensureTestCountry();
  });

  afterAll(async () => {
    for (const email of createdEmails) {
      const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
      if (user) {
        // registerRecipient() kaller requestMagicLink() til slutt, som
        // setter inn en auth_tokens-rad — glemt her først, se
        // NATTLOGG.md økt 7 (FK-feil ved sletting).
        await db.delete(authTokens).where(eq(authTokens.userId, user.id));
        await db.delete(consentRecords).where(eq(consentRecords.userId, user.id));
        await db.delete(emailSubscriptions).where(eq(emailSubscriptions.userId, user.id));
        await db.delete(users).where(eq(users.id, user.id));
      }
    }
  });

  it("oppretter bruker, e-postabonnement og FIRE samtykkerader for ÉN avkrysningsboks", async () => {
    const email = uniqueTestEmail("register");
    createdEmails.push(email);

    const result = await registerRecipient({
      email,
      countryCode: TEST_COUNTRY_CODE,
      locale: "nb-NO",
      consentEmailSubscription: true,
      consentTerms: true,
      consentMinimumAge: true,
    });

    expect(result.ok).toBe(true);

    const [user] = await db.select().from(users).where(eq(users.email, email));
    expect(user).toBeDefined();
    expect(user?.status).toBe("pending_email_verification");

    const subscription = await db
      .select()
      .from(emailSubscriptions)
      .where(eq(emailSubscriptions.userId, user!.id));
    expect(subscription).toHaveLength(1);
    expect(subscription[0]?.status).toBe("active");

    // ÉN avkrysningsboks (consentTerms) skal likevel gi TO rader — terms og
    // privacy versjoneres uavhengig (19.2). Pluss email_subscription og
    // minimum_age = fire totalt.
    const consents = await db.select().from(consentRecords).where(eq(consentRecords.userId, user!.id));
    const consentTypes = consents.map((c) => c.consentType).sort();
    expect(consentTypes).toEqual(
      ["email_subscription", "minimum_age", "privacy", "terms"].sort()
    );
    expect(consents.every((c) => c.granted)).toBe(true);
  });

  it("avviser registrering uten alle tre samtykkene", async () => {
    const email = uniqueTestEmail("no-consent");
    // Bevisst IKKE lagt til createdEmails — skal ikke opprettes i det hele tatt.

    const result = await registerRecipient({
      email,
      countryCode: TEST_COUNTRY_CODE,
      locale: "nb-NO",
      consentEmailSubscription: true,
      consentTerms: false,
      consentMinimumAge: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("errors.consent_required");

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    expect(user).toBeUndefined();
  });

  it("avviser andre registrering med SAMME e-post (race-beskyttelsen, ikke bare forhåndssjekken)", async () => {
    const email = uniqueTestEmail("duplicate");
    createdEmails.push(email);

    const input = {
      email,
      countryCode: TEST_COUNTRY_CODE,
      locale: "nb-NO" as const,
      consentEmailSubscription: true,
      consentTerms: true,
      consentMinimumAge: true,
    };

    const first = await registerRecipient(input);
    expect(first.ok).toBe(true);

    const second = await registerRecipient(input);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe("errors.email_already_registered");

    // Bekreft at det bare finnes ÉN bruker, ikke to — den egentlige garantien
    // er databasens unike constraint på e-post, ikke forhåndssjekken alene.
    const allUsers = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    expect(allUsers).toHaveLength(1);
  });
});
