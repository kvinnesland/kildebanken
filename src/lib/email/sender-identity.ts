import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { countries } from "@/db/schema";
import { createTranslator } from "@/i18n/get-messages";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";

export interface SenderIdentity {
  senderName: string;
  replyTo: string;
}

/**
 * SPEC-V1.md 10.4: "From-navnet lokaliseres per land og språk via
 * sender_name_key, og Reply-To settes til landets support_email." Delt
 * hjelpefunksjon for de mange kallestedene til `sendTransactionalEmail()`
 * (ni filer, se NATTLOGG.md Økt 54/55) — én implementasjon i stedet for
 * duplisert oppslag+oversettelse ved hvert av dem. `sendBulkEmail()` sin
 * tilsvarende logikk i tick.ts/digests.ts er IKKE flyttet hit: begge de
 * kallestedene har allerede landraden i scope (fra `runDigestTick()`s egen
 * løkke, henholdsvis én liten spørring i `retryFailedDigestDeliveries()`)
 * og trenger ingen ny spørring — denne funksjonen finnes for kallesteder
 * som KUN har en mottakers `countryCode`, ikke landraden selv.
 *
 * `null` hvis landet ikke finnes — kan ikke skje i praksis
 * (`users.countryCode` har en fremmednøkkel mot `countries.code`, se
 * schema.ts), men en manglende avsenderidentitet skal ALDRI stoppe selve
 * e-postsendingen (feiler åpent på denne forbedringen, ikke lukket).
 */
export async function resolveSenderIdentity(
  countryCode: string,
  locale: string
): Promise<SenderIdentity | null> {
  const [country] = await db
    .select({
      senderNameKey: countries.senderNameKey,
      supportEmail: countries.supportEmail,
      defaultLocale: countries.defaultLocale,
    })
    .from(countries)
    .where(eq(countries.code, countryCode))
    .limit(1);
  if (!country) return null;

  const resolvedLocale = isSupportedLocale(locale) ? locale : PLATFORM_DEFAULT_LOCALE;
  // SPEC-V1.md 3.4 sitt mellomledd i fallback-kjeden — se createTranslator()
  // sin egen kommentar (src/i18n/get-messages.ts) for hvorfor. Denne
  // funksjonen har landraden i scope uansett (for support_email), så
  // landets default_locale er allerede tilgjengelig her uten en ny spørring.
  const countryDefaultLocale = isSupportedLocale(country.defaultLocale)
    ? country.defaultLocale
    : PLATFORM_DEFAULT_LOCALE;
  return {
    senderName: createTranslator(resolvedLocale, countryDefaultLocale)(country.senderNameKey),
    replyTo: country.supportEmail,
  };
}
