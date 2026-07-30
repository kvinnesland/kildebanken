import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { emailSubscriptions, suppressions, users } from "@/db/schema";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { createActiveRecipient, ensureTestCountry } from "@/db/integration/fixtures";
import { unsubscribeByToken } from "./unsubscribe";

async function createSubscribedRecipient(): Promise<{ userId: string; email: string; rawToken: string }> {
  const recipient = await createActiveRecipient();
  const rawToken = generateToken();
  await db.insert(emailSubscriptions).values({
    userId: recipient.id,
    status: "active",
    unsubscribeTokenHash: hashToken(rawToken),
  });
  return { userId: recipient.id, email: recipient.email, rawToken };
}

describe("unsubscribeByToken mot ekte Postgres", () => {
  const createdUserIds: string[] = [];
  const createdEmailHashes: string[] = [];

  beforeAll(async () => {
    await ensureTestCountry();
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.delete(emailSubscriptions).where(eq(emailSubscriptions.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
    }
    for (const emailHash of createdEmailHashes) {
      await db.delete(suppressions).where(eq(suppressions.emailHash, emailHash));
    }
  });

  it("melder av abonnementet og legger adressen på sperrelisten (17.4)", async () => {
    const subscribed = await createSubscribedRecipient();
    createdUserIds.push(subscribed.userId);
    createdEmailHashes.push(hashToken(subscribed.email));

    const result = await unsubscribeByToken(subscribed.rawToken);
    expect(result.ok).toBe(true);

    const [subscription] = await db
      .select()
      .from(emailSubscriptions)
      .where(eq(emailSubscriptions.userId, subscribed.userId));
    expect(subscription?.status).toBe("unsubscribed");
    expect(subscription?.unsubscribedAt).not.toBeNull();

    const [suppression] = await db
      .select()
      .from(suppressions)
      .where(eq(suppressions.emailHash, hashToken(subscribed.email)));
    expect(suppression?.reason).toBe("unsubscribed");
  });

  it("er idempotent — et andre klikk på samme lenke er ikke en feil", async () => {
    const subscribed = await createSubscribedRecipient();
    createdUserIds.push(subscribed.userId);
    createdEmailHashes.push(hashToken(subscribed.email));

    const first = await unsubscribeByToken(subscribed.rawToken);
    expect(first.ok).toBe(true);
    const second = await unsubscribeByToken(subscribed.rawToken);
    expect(second.ok).toBe(true);
  });

  it("avviser et ukjent token", async () => {
    const result = await unsubscribeByToken("ukjent-token-som-ikke-finnes");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("errors.not_found");
  });
});
