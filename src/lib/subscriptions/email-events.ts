import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { digestDeliveries, emailSubscriptions, suppressions, users } from "@/db/schema";
import { hashToken } from "@/lib/auth/tokens";
import { shouldEscalateToHardBounce } from "./bounce-policy";

export type EmailEventType = "delivered" | "soft_bounce" | "hard_bounce" | "complaint";

export interface ProcessEmailEventInput {
  email: string;
  event: EmailEventType;
  // Satt av webhook-ruten når Brevo-nyttelasten inneholder en meldings-ID
  // (kun digest-utsendelser har en tilsvarende DigestDelivery-rad å koble
  // den til — transaksjonell e-post lagrer ingen ID, se send.ts).
  providerMessageId?: string;
}

export interface ProcessEmailEventResult {
  // false betyr "ingen abonnement funnet for denne adressen" — IKKE en
  // feil. Webhooken skal alltid svare 200 til leverandøren for en hendelse
  // vi ikke har noe å gjøre med (f.eks. en journalists transaksjonelle
  // e-post, som ikke har noen email_subscriptions-rad), ellers risikerer vi
  // unødvendige gjentatte forsøk fra leverandørens side.
  handled: boolean;
}

/**
 * POST /webhooks/email-events (SPEC-V1.md 10.1 punkt 9, 10.3, FR-037).
 * Kalt av e-postleverandøren (Brevo) etter hvert som hendelser skjer — IKKE
 * synkront i den daglige tikkejobben (10.1, ordrett). Tar en allerede
 * NORMALISERT hendelsestype — selve tolkningen av leverandørens
 * feltnavn/verdier skjer i ruten
 * (src/app/api/webhooks/email-events/route.ts), samme
 * adapter-/kjernelogikk-mønster som netlify/functions/tick.ts vs.
 * src/lib/jobs/tick.ts (INFRASTRUCTURE.md 16.8) — bytter vi
 * e-postleverandør, er det bare TOLKNINGEN i ruten som endres.
 */
export async function processEmailEvent(
  input: ProcessEmailEventInput
): Promise<ProcessEmailEventResult> {
  // 16.2 ("se ... bounces, klager" per digest) / 19.10: uavhengig av (og i
  // TILLEGG til) den globale abonnements-/sperrelistehåndteringen under —
  // kobler hendelsen til den SPESIFIKKE DigestDelivery-raden e-posten kom
  // fra, ikke bare brukerens abonnement generelt. Kjøres uansett om et
  // abonnement finnes for adressen, siden dette er et eget datapunkt.
  if (input.providerMessageId) {
    await updateDigestDeliveryStatus(input.providerMessageId, input.event);
  }

  const [subscription] = await db
    .select({
      id: emailSubscriptions.id,
      consecutiveSoftBounces: emailSubscriptions.consecutiveSoftBounces,
    })
    .from(emailSubscriptions)
    .innerJoin(users, eq(emailSubscriptions.userId, users.id))
    .where(eq(users.email, input.email))
    .limit(1);

  if (!subscription) return { handled: false };

  switch (input.event) {
    case "delivered":
      // Bryter en eventuell myk-bounce-rekke — "tre PÅ RAD" (10.3).
      if (subscription.consecutiveSoftBounces > 0) {
        await db
          .update(emailSubscriptions)
          .set({ consecutiveSoftBounces: 0 })
          .where(eq(emailSubscriptions.id, subscription.id));
      }
      return { handled: true };

    case "soft_bounce":
      if (shouldEscalateToHardBounce(subscription.consecutiveSoftBounces)) {
        await applyHardBounce(subscription.id, input.email);
      } else {
        await db
          .update(emailSubscriptions)
          .set({ consecutiveSoftBounces: subscription.consecutiveSoftBounces + 1 })
          .where(eq(emailSubscriptions.id, subscription.id));
      }
      return { handled: true };

    case "hard_bounce":
      await applyHardBounce(subscription.id, input.email);
      return { handled: true };

    case "complaint":
      // 10.3: "Spam-klage: abonnementet settes til unsubscribed umiddelbart."
      await db
        .update(emailSubscriptions)
        .set({ status: "unsubscribed", unsubscribedAt: new Date(), consecutiveSoftBounces: 0 })
        .where(eq(emailSubscriptions.id, subscription.id));
      // 19.13: sperrelisten er global på tvers av land, uavhengig av
      // årsak — en klage i ett marked skal blokkere i alle.
      await db
        .insert(suppressions)
        .values({ emailHash: hashToken(input.email), reason: "complaint" })
        .onConflictDoNothing();
      return { handled: true };
  }
}

async function applyHardBounce(subscriptionId: string, email: string): Promise<void> {
  // 10.3: "Hard bounce: adressen settes til bounced og får ingen flere
  // utsendelser."
  await db
    .update(emailSubscriptions)
    .set({ status: "bounced", consecutiveSoftBounces: 0 })
    .where(eq(emailSubscriptions.id, subscriptionId));
  await db
    .insert(suppressions)
    .values({ emailHash: hashToken(email), reason: "hard_bounce" })
    .onConflictDoNothing();
}

/**
 * Oppdaterer `DigestDelivery.status` for raden som ble sendt med denne
 * `provider_message_id`-en — en transaksjonell e-post har ingen slik rad
 * (send.ts lagrer aldri en ID for den), så en manglende treff her er
 * forventet og ikke en feil. `soft_bounce`/`hard_bounce` mappes begge til
 * `bounced` — datamodellen (19.10) skiller ikke mellom dem på
 * DigestDelivery-nivå, bare på selve abonnementet (10.3, over).
 */
async function updateDigestDeliveryStatus(
  providerMessageId: string,
  event: EmailEventType
): Promise<void> {
  const status =
    event === "delivered" ? "delivered" : event === "complaint" ? "complained" : "bounced";

  await db
    .update(digestDeliveries)
    .set({ status, updatedAt: new Date() })
    .where(eq(digestDeliveries.providerMessageId, providerMessageId));
}
