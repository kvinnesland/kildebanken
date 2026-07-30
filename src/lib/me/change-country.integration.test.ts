import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { authTokens, consentRecords, emailSubscriptions, users } from "@/db/schema";
import {
  createActiveRecipient,
  ensureSecondTestCountry,
  ensureTestCountry,
  TEST_COUNTRY_CODE,
  TEST_COUNTRY_CODE_2,
} from "@/db/integration/fixtures";
import { changeCountry } from "./change-country";

describe("changeCountry mot ekte Postgres", () => {
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    await ensureTestCountry();
    await ensureSecondTestCountry();
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.delete(authTokens).where(eq(authTokens.userId, userId));
      await db.delete(consentRecords).where(eq(consentRecords.userId, userId));
      await db.delete(emailSubscriptions).where(eq(emailSubscriptions.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
    }
  });

  it("bytter land, trekker gammelt terms/privacy-samtykke og skriver nytt (7.3)", async () => {
    const recipient = await createActiveRecipient();
    createdUserIds.push(recipient.id);

    // Simuler samtykke gitt ved registrering i det opprinnelige landet.
    await db.insert(consentRecords).values([
      {
        userId: recipient.id,
        consentType: "terms",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        granted: true,
        source: "registration_form",
      },
      {
        userId: recipient.id,
        consentType: "privacy",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        granted: true,
        source: "registration_form",
      },
    ]);

    const result = await changeCountry(recipient.id, {
      countryCode: TEST_COUNTRY_CODE_2,
      locale: "nb-NO",
      consentTerms: true,
    });
    expect(result.ok).toBe(true);

    const [user] = await db.select().from(users).where(eq(users.id, recipient.id));
    expect(user?.countryCode).toBe(TEST_COUNTRY_CODE_2);

    const activeConsents = await db
      .select()
      .from(consentRecords)
      .where(and(eq(consentRecords.userId, recipient.id), isNull(consentRecords.withdrawnAt)));
    const activeTypes = activeConsents.map((c) => c.consentType).sort();
    expect(activeTypes).toEqual(["privacy", "terms"]);
    expect(activeConsents.every((c) => c.countryCode === TEST_COUNTRY_CODE_2)).toBe(true);
    expect(activeConsents.every((c) => c.source === "country_change")).toBe(true);

    const withdrawnConsents = await db
      .select()
      .from(consentRecords)
      .where(
        and(
          eq(consentRecords.userId, recipient.id),
          eq(consentRecords.countryCode, TEST_COUNTRY_CODE)
        )
      );
    expect(withdrawnConsents).toHaveLength(2);
    expect(withdrawnConsents.every((c) => c.withdrawnAt !== null)).toBe(true);
  });

  it("gjennomfører IKKE byttet dersom vilkårene avslås — country_code står uendret (FR-010)", async () => {
    const recipient = await createActiveRecipient();
    createdUserIds.push(recipient.id);

    const result = await changeCountry(recipient.id, {
      countryCode: TEST_COUNTRY_CODE_2,
      locale: "nb-NO",
      consentTerms: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("errors.consent_required");

    const [user] = await db.select().from(users).where(eq(users.id, recipient.id));
    expect(user?.countryCode).toBe(TEST_COUNTRY_CODE);
  });
});
