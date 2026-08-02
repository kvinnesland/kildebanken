import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { createActiveRecipient, ensureTestCountry, TEST_COUNTRY_CODE } from "@/db/integration/fixtures";
import { getMyProfile, updateMyProfile } from "./profile";

describe("updateMyProfile mot ekte Postgres", () => {
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    await ensureTestCountry();
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.delete(users).where(eq(users.id, userId));
    }
  });

  it("oppdaterer visningsnavn og timezone", async () => {
    const recipient = await createActiveRecipient();
    createdUserIds.push(recipient.id);

    const result = await updateMyProfile(recipient.id, {
      displayName: "Kari",
      timezone: "Europe/Oslo",
    });
    expect(result.ok).toBe(true);

    const [user] = await db.select().from(users).where(eq(users.id, recipient.id));
    expect(user?.displayName).toBe("Kari");
    expect(user?.timezone).toBe("Europe/Oslo");
  });

  it("avviser en ugyldig tidssone uten å skrive noe", async () => {
    const recipient = await createActiveRecipient();
    createdUserIds.push(recipient.id);

    const result = await updateMyProfile(recipient.id, { timezone: "Not/A_Timezone" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("errors.invalid_timezone");

    const [user] = await db.select().from(users).where(eq(users.id, recipient.id));
    expect(user?.timezone).toBeNull();
  });

  it("avviser en locale som ikke er tilgjengelig i brukerens land", async () => {
    const recipient = await createActiveRecipient();
    createdUserIds.push(recipient.id);

    const result = await updateMyProfile(recipient.id, { locale: "fr-FR" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("errors.invalid_locale");
  });
});

describe("getMyProfile mot ekte Postgres", () => {
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    await ensureTestCountry();
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.delete(users).where(eq(users.id, userId));
    }
  });

  it("inkluderer landets navnenøkkel og tilgjengelige locales, ikke bare brukerens egne felt", async () => {
    const recipient = await createActiveRecipient();
    createdUserIds.push(recipient.id);

    const profile = await getMyProfile(recipient.id);
    expect(profile?.email).toBe(recipient.email);
    expect(profile?.countryCode).toBe(TEST_COUNTRY_CODE);
    expect(profile?.availableLocales).toContain("nb-NO");
    expect(typeof profile?.countryNameKey).toBe("string");
  });

  it("returnerer null for en ukjent bruker-id", async () => {
    const profile = await getMyProfile("00000000-0000-0000-0000-000000000000");
    expect(profile).toBeNull();
  });
});
