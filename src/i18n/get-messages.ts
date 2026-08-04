import { IntlMessageFormat } from "intl-messageformat";
import { PLATFORM_DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "./config";

import nbNO from "./messages/nb-NO.json";
import enGB from "./messages/en-GB.json";

// Bevisst UTEN `import "server-only"` (fjernet økt 4, se NATTLOGG.md): denne
// modulen importeres av src/lib/jobs/tick.ts, som kjøres av
// netlify/functions/tick.ts — en frittstående funksjon utenfor Next.js sin
// egen bundler, og av vitest direkte. "server-only" kaster ubetinget i begge
// de kontekstene, uavhengig av at koden faktisk aldri når en nettleser.
// src/lib/auth/session.ts beholder "server-only" fordi den bruker
// next/headers, som er reelt Next.js-request-kontekst-bundet.

const MESSAGE_SETS: Record<SupportedLocale, Record<string, string>> = {
  "nb-NO": nbNO,
  "en-GB": enGB,
};

/**
 * Fallback-kjeden fra SPEC-V1.md 3.4: forespurt locale → landets
 * default_locale → plattformens standardspråk. Denne funksjonen tar bare
 * imot den ferdig utledede listen (kalleren slår opp landets default_locale
 * fra `countries`-tabellen) — den vet ingenting om land selv, jf. 3.1 (locale
 * og land er uavhengige akser, og skal ikke blandes sammen i samme funksjon).
 *
 * Manglende nøkkel i ALLE ledd i kjeden er en feil som skal logges (3.4) —
 * aldri vises som en rå nøkkel til sluttbruker.
 */
export function resolveMessage(
  key: string,
  fallbackChain: readonly string[],
  values?: Record<string, string | number | Date>
): string {
  for (const locale of fallbackChain) {
    if (!isKnownLocale(locale)) continue;
    const raw = MESSAGE_SETS[locale][key];
    if (raw === undefined) continue;
    return format(raw, locale, values);
  }

  // Siste utvei: plattformens standardspråk, uansett hva som var i kjeden.
  const platformRaw = MESSAGE_SETS[PLATFORM_DEFAULT_LOCALE][key];
  if (platformRaw !== undefined) {
    logMissingKey(key, fallbackChain);
    return format(platformRaw, PLATFORM_DEFAULT_LOCALE, values);
  }

  // Nøkkelen finnes ikke i det hele tatt, selv ikke i standardspråket. Dette
  // skal være umulig i produksjon hvis FR-012 (CI-sjekk) håndheves — se
  // check-keys.ts. Vi logger og returnerer noe lesbart, aldri nøkkelen rått.
  logMissingKey(key, fallbackChain, /* critical */ true);
  return "…";
}

function format(
  raw: string,
  locale: string,
  values?: Record<string, string | number | Date>
): string {
  if (!values) return raw;
  const msg = new IntlMessageFormat(raw, locale);
  return msg.format(values) as string;
}

function isKnownLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function logMissingKey(key: string, chain: readonly string[], critical = false) {
  const message = `[i18n] mangler nøkkel "${key}" i kjeden [${chain.join(", ")}]`;
  if (critical) {
    console.error(message + " — mangler også i plattformens standardspråk.");
  } else {
    console.warn(message);
  }
}

/** Henter hele meldingssettet for én locale — brukes av klientkomponenter. */
export function getMessagesForLocale(locale: SupportedLocale): Record<string, string> {
  return MESSAGE_SETS[locale];
}

/**
 * Ergonomisk `t(key, values?)`-funksjon bundet til én locale. Dette er
 * mønsteret `src/i18n/check-keys.ts` (FR-012) faktisk leter etter i
 * kildekoden — bruk denne i stedet for å lese `messages[...]` direkte, slik
 * at nøkkelbruk forblir grep-bar og CI-sjekkbar.
 *
 * `countryDefaultLocale` er det andre leddet i 3.4 sin fallback-kjede
 * ("forespurt locale → landets default_locale → plattformens
 * standardspråk") — VALGFRITT, siden de aller fleste kallesteder (statiske
 * sidekomponenter uten et kjent lands kontekst) ikke har denne informasjonen
 * lett tilgjengelig. Reelt hull frem til nå, funnet ved et grep etter
 * eksporterte-men-aldri-brukte navn (se NATTLOGG.md, samme metode som
 * avdekket `tokensMatch()`): `resolveMessage()` under implementerte
 * nøyaktig denne tre-ledds-kjeden allerede, men var aldri faktisk koblet inn
 * her — `createTranslator()` hoppet rett fra forespurt locale til
 * plattformens standardspråk, uten å noensinne prøve landets eget
 * `default_locale` i mellom. Uten observerbar effekt i dagens v1 (kun ett
 * land, og de to eneste locale-ene er alltid fullstendig synkronisert — se
 * `check-keys.ts` sin egen advarsel-mekanisme), men ville blitt en reell,
 * synlig feil den dagen land nummer to legges til med en egen,
 * ikke-standard `default_locale` og en ufullstendig tredje locale (21.3
 * tillater nettopp det). Bakoverkompatibel: uendret oppførsel for alle
 * eksisterende kallesteder, som fortsatt kun oppgir `locale`.
 */
export function createTranslator(locale: SupportedLocale, countryDefaultLocale?: SupportedLocale) {
  const fallbackChain =
    countryDefaultLocale && countryDefaultLocale !== locale
      ? [locale, countryDefaultLocale]
      : [locale];
  return function t(key: string, values?: Record<string, string | number | Date>): string {
    return resolveMessage(key, fallbackChain, values);
  };
}
