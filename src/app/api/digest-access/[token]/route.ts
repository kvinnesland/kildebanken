import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { digestDeliveries, users } from "@/db/schema";
import { hashToken } from "@/lib/auth/tokens";
import { createSession } from "@/lib/auth/session";
import { PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { isSafeRelativePath } from "@/lib/http/safe-redirect";

/**
 * GET /api/digest-access/:token — fullfører SPEC-V1.md 6.2: bytter et
 * digest-tilgangstoken (opprettet per mottaker per utsendelse i
 * `runDigestTick`, se `src/lib/jobs/tick.ts`) inn i en innlogget økt på 30
 * dager, og videresender til forespørselssiden lenken faktisk peker på.
 *
 * **Gjenbrukbart, ikke engangsbruk** — bevisst valg (økt 5, se NATTLOGG.md):
 * en bruker skal kunne klikke seg inn igjen fra en ukes gammel digest-e-post
 * uten å måtte be om en ny innloggingslenke. `DigestDelivery` har ingen
 * utløpstid eller "brukt"-flagg for dette formålet, i motsetning til
 * `AuthToken` (19.14) som er engangsbruk. Skulle tokenet kompromitteres, er
 * mottiltaket å rotere det ved neste digest — samme mønster som
 * avmeldingstokenet i `src/lib/email/digest.ts`.
 *
 * Token ligger i PATH-en, destinasjonen i et `to`-søkeparameter — validert
 * mot åpen redirect nedenfor, siden det er den eneste brukerstyrte delen av
 * URL-en.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const url = new URL(request.url);
  const destination = url.searchParams.get("to");
  const safeDestination = isSafeRelativePath(destination)
    ? destination
    : `/${PLATFORM_DEFAULT_LOCALE}`;

  const [delivery] = await db
    .select({
      userId: digestDeliveries.userId,
      role: users.role,
      status: users.status,
    })
    .from(digestDeliveries)
    .innerJoin(users, eq(digestDeliveries.userId, users.id))
    .where(eq(digestDeliveries.accessTokenHash, hashToken(token)))
    .limit(1);

  // Ugyldig token, eller kontoen er suspendert/slettet siden utsendelsen:
  // videresend uten å opprette økt. Ingen feilmelding som avslører hvorfor —
  // samme "avslør ingenting"-prinsipp som i src/lib/auth/magic-link.ts.
  if (!delivery || delivery.status !== "active") {
    return NextResponse.redirect(new URL(safeDestination, url.origin));
  }

  await createSession(delivery.userId, delivery.role);

  return NextResponse.redirect(new URL(safeDestination, url.origin));
}
