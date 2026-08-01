import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { digestDeliveries, digests, emailSubscriptions, suppressions } from "@/db/schema";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { createActiveRecipient, TEST_COUNTRY_CODE } from "@/db/integration/fixtures";
import { POST } from "./route";

// Ingen next/headers-/økt-avhengighet — ruten bruker delt hemmelighet via
// søkeparameter/header, ikke en innlogget økt (Brevo er ikke en nettleser).
// Denne ruten skiller seg fra resten av src/app/api/ (tynne adaptere over
// allerede testede lib-funksjoner): isAuthorized()/normalizeEvent() er egen
// logikk som bare finnes her, aldri testet noe sted frem til nå (se
// NATTLOGG.md).

const WEBHOOK_URL = "https://kildebanken.example/api/webhooks/email-events";

async function createSubscribedRecipient(): Promise<{
  userId: string;
  email: string;
  subscriptionId: string;
}> {
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

function postRequest(
  body: unknown,
  opts: { secret?: string; secretHeader?: string } = {}
): Request {
  const url = new URL(WEBHOOK_URL);
  if (opts.secret !== undefined) url.searchParams.set("secret", opts.secret);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.secretHeader !== undefined) headers["x-webhook-secret"] = opts.secretHeader;
  return new Request(url, { method: "POST", headers, body: JSON.stringify(body) });
}

describe("POST /webhooks/email-events mot ekte Postgres (SPEC-V1.md 10.1/10.3, FR-037)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("avviser med 401 når EMAIL_WEBHOOK_SECRET ikke er satt i miljøet", async () => {
    vi.stubEnv("EMAIL_WEBHOOK_SECRET", "");
    const response = await POST(
      postRequest({ email: "a@b.invalid", event: "delivered" }, { secret: "whatever" })
    );
    expect(response.status).toBe(401);
  });

  it("avviser med 401 når hemmeligheten oppgitt via søkeparameter er feil", async () => {
    vi.stubEnv("EMAIL_WEBHOOK_SECRET", "riktig-hemmelighet");
    const response = await POST(
      postRequest({ email: "a@b.invalid", event: "delivered" }, { secret: "feil" })
    );
    expect(response.status).toBe(401);
  });

  it("avviser med 401 når ingen hemmelighet er oppgitt i det hele tatt", async () => {
    vi.stubEnv("EMAIL_WEBHOOK_SECRET", "riktig-hemmelighet");
    const response = await POST(postRequest({ email: "a@b.invalid", event: "delivered" }));
    expect(response.status).toBe(401);
  });

  it("godtar hemmeligheten via søkeparameter", async () => {
    vi.stubEnv("EMAIL_WEBHOOK_SECRET", "riktig-hemmelighet");
    const sub = await createSubscribedRecipient();
    const response = await POST(
      postRequest({ email: sub.email, event: "delivered" }, { secret: "riktig-hemmelighet" })
    );
    expect(response.status).toBe(200);
  });

  it("godtar hemmeligheten via x-webhook-secret-header", async () => {
    vi.stubEnv("EMAIL_WEBHOOK_SECRET", "riktig-hemmelighet");
    const sub = await createSubscribedRecipient();
    const response = await POST(
      postRequest({ email: sub.email, event: "delivered" }, { secretHeader: "riktig-hemmelighet" })
    );
    expect(response.status).toBe(200);
  });

  it("avviser med 400 for en ugyldig kropp (mangler event)", async () => {
    vi.stubEnv("EMAIL_WEBHOOK_SECRET", "riktig-hemmelighet");
    const response = await POST(
      postRequest({ email: "a@b.invalid" }, { secret: "riktig-hemmelighet" })
    );
    expect(response.status).toBe(400);
  });

  it("avviser med 400 for en ugyldig e-postadresse", async () => {
    vi.stubEnv("EMAIL_WEBHOOK_SECRET", "riktig-hemmelighet");
    const response = await POST(
      postRequest({ email: "ikke-en-epost", event: "delivered" }, { secret: "riktig-hemmelighet" })
    );
    expect(response.status).toBe(400);
  });

  it("avviser med 400 for ikke-parsbar JSON", async () => {
    vi.stubEnv("EMAIL_WEBHOOK_SECRET", "riktig-hemmelighet");
    const url = new URL(WEBHOOK_URL);
    url.searchParams.set("secret", "riktig-hemmelighet");
    const request = new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "dette er ikke json",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("behandler en kjent hendelsestype (hard_bounce) og sperrer adressen", async () => {
    vi.stubEnv("EMAIL_WEBHOOK_SECRET", "riktig-hemmelighet");
    const sub = await createSubscribedRecipient();

    const response = await POST(
      postRequest({ email: sub.email, event: "hard_bounce" }, { secret: "riktig-hemmelighet" })
    );

    expect(response.status).toBe(200);
    const [row] = await db
      .select()
      .from(emailSubscriptions)
      .where(eq(emailSubscriptions.id, sub.subscriptionId));
    expect(row?.status).toBe("bounced");
    const [suppression] = await db
      .select()
      .from(suppressions)
      .where(eq(suppressions.emailHash, hashToken(sub.email)));
    expect(suppression?.reason).toBe("hard_bounce");
  });

  it("normaliserer camelCase-hendelser fra leverandøren (HardBounce -> hard_bounce)", async () => {
    // normalizeEvent() sin egen kommentar sier den defensivt dekker BÅDE
    // snake_case og camelCase, siden Brevo sitt eksakte feltformat ikke er
    // bekreftet mot ekte dokumentasjon i denne økten — denne testen beviser
    // i det minste at selve normaliseringslogikken faktisk gjør det den
    // hevder å gjøre.
    vi.stubEnv("EMAIL_WEBHOOK_SECRET", "riktig-hemmelighet");
    const sub = await createSubscribedRecipient();

    const response = await POST(
      postRequest({ email: sub.email, event: "HardBounce" }, { secret: "riktig-hemmelighet" })
    );

    expect(response.status).toBe(200);
    const [row] = await db
      .select()
      .from(emailSubscriptions)
      .where(eq(emailSubscriptions.id, sub.subscriptionId));
    expect(row?.status).toBe("bounced");
  });

  it("behandler Brevos faktiske 'invalid'-hendelse (permanent ugyldig adresse) som hard_bounce, ikke bare 'invalid_email'", async () => {
    // Bekreftet mot Brevos offentlige dokumentasjon (økt 11, se
    // NATTLOGG.md): den faktiske hendelsesverdien er "invalid", ikke
    // "invalid_email" som normalizeEvent() sjekket mot før denne rettingen
    // — denne testen beviser at retten faktisk fanger den ekte verdien.
    vi.stubEnv("EMAIL_WEBHOOK_SECRET", "riktig-hemmelighet");
    const sub = await createSubscribedRecipient();

    const response = await POST(
      postRequest({ email: sub.email, event: "invalid" }, { secret: "riktig-hemmelighet" })
    );

    expect(response.status).toBe(200);
    const [row] = await db
      .select()
      .from(emailSubscriptions)
      .where(eq(emailSubscriptions.id, sub.subscriptionId));
    expect(row?.status).toBe("bounced");
  });

  it("videresender \"message-id\" fra nyttelasten som providerMessageId, og oppdaterer den SPESIFIKKE DigestDelivery-en (19.10, 16.2)", async () => {
    vi.stubEnv("EMAIL_WEBHOOK_SECRET", "riktig-hemmelighet");
    const sub = await createSubscribedRecipient();
    const [digest] = await db
      .insert(digests)
      .values({
        countryCode: TEST_COUNTRY_CODE,
        // 10 millioner dager, ikke 1000 (se NATTLOGG.md) — samme formel
        // fantes uavhengig i digests.integration.test.ts og
        // email-events.integration.test.ts mot SAMME TEST_COUNTRY_CODE, og
        // ga en bekreftet fødselsdagsparadoks-kollisjon på
        // digests_country_scheduled_for_idx ved kjøring av hele suiten.
        scheduledFor: new Date(Date.now() + Math.floor(Math.random() * 10_000_000 * 86_400_000))
          .toISOString()
          .slice(0, 10),
        requestIds: [],
        status: "sent",
      })
      .returning({ id: digests.id });
    if (!digest) throw new Error("Kunne ikke opprette test-digest");
    const providerMessageId = `<route-test-${generateToken()}@relay.brevo.com>`;
    const [delivery] = await db
      .insert(digestDeliveries)
      .values({
        digestId: digest.id,
        userId: sub.userId,
        locale: "nb-NO",
        accessTokenHash: hashToken(generateToken()),
        status: "sent",
        providerMessageId,
      })
      .returning({ id: digestDeliveries.id });
    if (!delivery) throw new Error("Kunne ikke opprette test-DigestDelivery");

    const response = await POST(
      postRequest(
        { email: sub.email, event: "hard_bounce", "message-id": providerMessageId },
        { secret: "riktig-hemmelighet" }
      )
    );

    expect(response.status).toBe(200);
    const [deliveryRow] = await db
      .select()
      .from(digestDeliveries)
      .where(eq(digestDeliveries.id, delivery.id));
    expect(deliveryRow?.status).toBe("bounced");
  });

  it("returnerer 200 uten noen handling for en ukjent/irrelevant hendelsestype (f.eks. 'opened')", async () => {
    // 200, ikke 4xx — "ukjent eller irrelevant hendelsestype" skal ikke få
    // leverandøren til å gjenta forsøket unødvendig (route.ts sin egen
    // kommentar).
    vi.stubEnv("EMAIL_WEBHOOK_SECRET", "riktig-hemmelighet");
    const sub = await createSubscribedRecipient();

    const response = await POST(
      postRequest({ email: sub.email, event: "opened" }, { secret: "riktig-hemmelighet" })
    );

    expect(response.status).toBe(200);
    const [row] = await db
      .select()
      .from(emailSubscriptions)
      .where(eq(emailSubscriptions.id, sub.subscriptionId));
    expect(row?.status).toBe("active");
  });
});
