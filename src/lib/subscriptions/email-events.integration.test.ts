import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { digestDeliveries, digests, emailSubscriptions, suppressions, users } from "@/db/schema";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import {
  createActiveRecipient,
  ensureTestCountry,
  TEST_COUNTRY_CODE,
} from "@/db/integration/fixtures";
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
      // digestDeliveries.user_id har ingen CASCADE (som INGEN fremmednøkkel i
      // dette skjemaet har, se NATTLOGG.md) — må ryddes FØR brukerraden
      // slettes, ellers feiler slettingen under med et fremmednøkkelbrudd
      // for de nye providerMessageId-testene under, som oppretter nettopp en
      // slik rad.
      await db.delete(digestDeliveries).where(eq(digestDeliveries.userId, userId));
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

  // 16.2 ("bounces, klager" per digest) / 19.10: providerMessageId kobler en
  // webhook-hendelse til den SPESIFIKKE DigestDelivery-raden, uavhengig av
  // den globale abonnementshåndteringen testet over. Var tidligere en
  // reell, udekket mangel — se NATTLOGG.md.
  describe("providerMessageId → DigestDelivery-kobling (19.10, 16.2)", () => {
    async function createDigestDelivery(): Promise<{
      email: string;
      userId: string;
      deliveryId: string;
      providerMessageId: string;
    }> {
      const recipient = await createActiveRecipient();
      createdUserIds.push(recipient.id);
      // Tilfeldig dato over et bredt spekter unngår kollisjon med det unike
      // (country_code, scheduled_for)-paret ved parallell testkjøring (samme
      // mønster som digests.integration.test.ts sin uniqueScheduledFor()).
      // 10 millioner dager, ikke 1000 (se NATTLOGG.md) — et spekter på bare
      // 1000 dager, duplisert uavhengig i to andre filer mot samme
      // TEST_COUNTRY_CODE, ga en bekreftet kollisjon på
      // digests_country_scheduled_for_idx ved kjøring av hele suiten.
      const scheduledFor = new Date(Date.now() + Math.floor(Math.random() * 10_000_000 * 86_400_000))
        .toISOString()
        .slice(0, 10);
      const [digest] = await db
        .insert(digests)
        .values({
          countryCode: TEST_COUNTRY_CODE,
          scheduledFor,
          requestIds: [],
          status: "sent",
        })
        .returning({ id: digests.id });
      if (!digest) throw new Error("Kunne ikke opprette test-digest");

      const providerMessageId = `<test-${generateToken()}@relay.brevo.com>`;
      const [delivery] = await db
        .insert(digestDeliveries)
        .values({
          digestId: digest.id,
          userId: recipient.id,
          locale: "nb-NO",
          accessTokenHash: hashToken(generateToken()),
          status: "sent",
          providerMessageId,
        })
        .returning({ id: digestDeliveries.id });
      if (!delivery) throw new Error("Kunne ikke opprette test-DigestDelivery");

      return { email: recipient.email, userId: recipient.id, deliveryId: delivery.id, providerMessageId };
    }

    it("hard_bounce setter DEN SPESIFIKKE DigestDelivery-en til bounced", async () => {
      const delivery = await createDigestDelivery();

      await processEmailEvent({
        email: delivery.email,
        event: "hard_bounce",
        providerMessageId: delivery.providerMessageId,
      });

      const [row] = await db
        .select()
        .from(digestDeliveries)
        .where(eq(digestDeliveries.id, delivery.deliveryId));
      expect(row?.status).toBe("bounced");
    });

    it("complaint setter DigestDelivery-en til complained", async () => {
      const delivery = await createDigestDelivery();

      await processEmailEvent({
        email: delivery.email,
        event: "complaint",
        providerMessageId: delivery.providerMessageId,
      });

      const [row] = await db
        .select()
        .from(digestDeliveries)
        .where(eq(digestDeliveries.id, delivery.deliveryId));
      expect(row?.status).toBe("complained");
    });

    it("delivered setter DigestDelivery-en til delivered", async () => {
      const delivery = await createDigestDelivery();

      await processEmailEvent({
        email: delivery.email,
        event: "delivered",
        providerMessageId: delivery.providerMessageId,
      });

      const [row] = await db
        .select()
        .from(digestDeliveries)
        .where(eq(digestDeliveries.id, delivery.deliveryId));
      expect(row?.status).toBe("delivered");
    });

    it("en providerMessageId uten treff (f.eks. en transaksjonell e-post) feiler ikke, og rører ingen DigestDelivery", async () => {
      const delivery = await createDigestDelivery();

      await expect(
        processEmailEvent({
          email: delivery.email,
          event: "hard_bounce",
          providerMessageId: "<ukjent-id-uten-treff@relay.brevo.com>",
        })
      ).resolves.toBeDefined();

      const [row] = await db
        .select()
        .from(digestDeliveries)
        .where(eq(digestDeliveries.id, delivery.deliveryId));
      expect(row?.status).toBe("sent");
    });
  });
});
