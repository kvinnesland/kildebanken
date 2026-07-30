import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { createActiveRecipient, ensureTestCountry } from "@/db/integration/fixtures";
import { updateMyProfile } from "./profile";

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
