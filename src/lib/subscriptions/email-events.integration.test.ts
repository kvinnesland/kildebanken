import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { emailSubscriptions, suppressions, users } from "@/db/schema";
import { hashToken } from "@/lib/auth/tokens";
import { createActiveRecipient, ensureTestCountry } from "@/db/integration/fixtures";
import { processEmailEvent } from "./email-events";

async function createSubscribedRecipient(): Promise<{ userId: string; email: string; subscriptionId: string }> {
  const recipient = await createActiveRecipient();
  const [subscription] = await db
    .insert(emailSubscriptions)
    .values({
      userId: recipient.id,
      status: "active",
      unsubscribeTokenHash: hashToken(`unused-${recipient.email}`),
    })
    .returning({ id: emailSubscriptions.id });
  if (!subscription) throw new Error("Kunne ikke opprette test-abonnement");
  return { userId: recipient.id, email: recipient.email, subscriptionId: subscription.id };
}

describe("processEmailEvent mot ekte Postgres (10.3, FR-037)", () => {
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

  it("returnerer handled:false for en e-post uten noe abonnement, uten å feile", async () => {
    const result = await processEmailEvent({ email: "ukjent@example.invalid", event: "hard_bounce" });
    expect(result.handled).toBe(false);
  });

  it("hard bounce setter status til bounced og sperrer adressen", async () => {
    const sub = await createSubscribedRecipient();
    createdUserIds.push(sub.userId);
    createdEmailHashes.push(hashToken(sub.email));

    const result = await processEmailEvent({ email: sub.email, event: "hard_bounce" });
    expect(result.handled).toBe(true);

    const [row] = await db.select().from(emailSubscriptions).where(eq(emailSubscriptions.id, sub.subscriptionId));
    expect(row?.status).toBe("bounced");

    const [suppression] = await db.select().from(suppressions).where(eq(suppressions.emailHash, hashToken(sub.email)));
    expect(suppression?.reason).toBe("hard_bounce");
  });

  it("spam-klage setter abonnementet til unsubscribed og sperrer adressen", async () => {
    const sub = await createSubscribedRecipient();
    createdUserIds.push(sub.userId);
    createdEmailHashes.push(hashToken(sub.email));

    const result = await processEmailEvent({ email: sub.email, event: "complaint" });
    expect(result.handled).toBe(true);

    const [row] = await db.select().from(emailSubscriptions).where(eq(emailSubscriptions.id, sub.subscriptionId));
    expect(row?.status).toBe("unsubscribed");
    expect(row?.unsubscribedAt).not.toBeNull();

    const [suppression] = await db.select().from(suppressions).where(eq(suppressions.emailHash, hashToken(sub.email)));
    expect(suppression?.reason).toBe("complaint");
  });

  it("to myke bounces øker telleren, men eskalerer IKKE ennå", async () => {
    const sub = await createSubscribedRecipient();
    createdUserIds.push(sub.userId);

    await processEmailEvent({ email: sub.email, event: "soft_bounce" });
    await processEmailEvent({ email: sub.email, event: "soft_bounce" });

    const [row] = await db.select().from(emailSubscriptions).where(eq(emailSubscriptions.id, sub.subscriptionId));
    expect(row?.status).toBe("active");
    expect(row?.consecutiveSoftBounces).toBe(2);
  });

  it("tre myke bounces PÅ RAD eskalerer til hard bounce (10.3, ordrett)", async () => {
    const sub = await createSubscribedRecipient();
    createdUserIds.push(sub.userId);
    createdEmailHashes.push(hashToken(sub.email));

    await processEmailEvent({ email: sub.email, event: "soft_bounce" });
    await processEmailEvent({ email: sub.email, event: "soft_bounce" });
    const third = await processEmailEvent({ email: sub.email, event: "soft_bounce" });
    expect(third.handled).toBe(true);

    const [row] = await db.select().from(emailSubscriptions).where(eq(emailSubscriptions.id, sub.subscriptionId));
    expect(row?.status).toBe("bounced");
    expect(row?.consecutiveSoftBounces).toBe(0);

    const [suppression] = await db.select().from(suppressions).where(eq(suppressions.emailHash, hashToken(sub.email)));
    expect(suppression?.reason).toBe("hard_bounce");
  });

  it("en vellykket levering bryter en påbegynt myk-bounce-rekke", async () => {
    const sub = await createSubscribedRecipient();
    createdUserIds.push(sub.userId);

    await processEmailEvent({ email: sub.email, event: "soft_bounce" });
    await processEmailEvent({ email: sub.email, event: "soft_bounce" });
    await processEmailEvent({ email: sub.email, event: "delivered" });

    const [row] = await db.select().from(emailSubscriptions).where(eq(emailSubscriptions.id, sub.subscriptionId));
    expect(row?.consecutiveSoftBounces).toBe(0);

    // Rekken skal starte på nytt — to nye myke bounces skal IKKE eskalere.
    await processEmailEvent({ email: sub.email, event: "soft_bounce" });
    await processEmailEvent({ email: sub.email, event: "soft_bounce" });
    const [rowAfter] = await db.select().from(emailSubscriptions).where(eq(emailSubscriptions.id, sub.subscriptionId));
    expect(rowAfter?.status).toBe("active");
  });
});
