import { NextResponse } from "next/server";
import { z } from "zod";
import { processEmailEvent, type EmailEventType } from "@/lib/subscriptions/email-events";

// POST /webhooks/email-events (SPEC-V1.md 10.1 punkt 9, 10.3, 20, FR-037).
// Kalt av Brevo, ikke en innlogget bruker — beskyttet av en delt
// hemmelighet i stedet for en økt. Feiler LUKKET (401) dersom hemmeligheten
// mangler i miljøet, samme "trygg standard"-prinsipp som RETENTION_DRY_RUN.
function isAuthorized(request: Request): boolean {
  const configuredSecret = process.env.EMAIL_WEBHOOK_SECRET;
  if (!configuredSecret) return false;

  const url = new URL(request.url);
  const provided = url.searchParams.get("secret") ?? request.headers.get("x-webhook-secret");
  return provided === configuredSecret;
}

const bodySchema = z.object({
  email: z.string().email(),
  event: z.string(),
  // Brevo sitt feltnavn for meldings-ID i webhook-nyttelasten — samme
  // forbehold som normalizeEvent() under (ikke bekreftet mot ekte
  // dokumentasjon denne økten). Valgfritt: mangler den, hopper vi bare over
  // DigestDelivery-koblingen (processEmailEvent) og gjør resten som før.
  "message-id": z.string().optional(),
});

/**
 * Brevo sitt eget feltnavn for hendelsestype/verdiene er IKKE bekreftet mot
 * faktisk dokumentasjon i denne økten (ingen API-nøkkel/nettverkstilgang
 * til Brevo tilgjengelig) — normaliseringen under dekker de mest sannsynlige
 * stavemåtene (både snake_case og camelCase) defensivt. MÅ verifiseres mot
 * ekte Brevo-webhook-nyttelast før produksjon, se TODO i
 * src/lib/email/send.ts for samme forbehold om selve Brevo-integrasjonen.
 */
function normalizeEvent(rawEvent: string): EmailEventType | null {
  const normalized = rawEvent.toLowerCase().replace(/[^a-z]/g, "_");
  switch (normalized) {
    case "delivered":
      return "delivered";
    case "soft_bounce":
    case "softbounce":
      return "soft_bounce";
    case "hard_bounce":
    case "hardbounce":
    case "blocked":
    case "invalid_email":
      return "hard_bounce";
    case "spam":
    case "complaint":
      return "complaint";
    default:
      return null;
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "errors.not_authorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.generic" }, { status: 400 });
  }

  const normalizedEvent = normalizeEvent(parsed.data.event);
  if (!normalizedEvent) {
    // Ukjent eller irrelevant hendelsestype (f.eks. "opened", "click") —
    // ingen handling, men fortsatt 200 slik at leverandøren ikke gjentar
    // forsøket unødvendig.
    return NextResponse.json({ ok: true });
  }

  await processEmailEvent({
    email: parsed.data.email.toLowerCase().trim(),
    event: normalizedEvent,
    providerMessageId: parsed.data["message-id"],
  });

  return NextResponse.json({ ok: true });
}
