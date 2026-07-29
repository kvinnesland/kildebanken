import "server-only";
import { IntlMessageFormat } from "intl-messageformat";
import { PLATFORM_DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "./config";

import nbNO from "./messages/nb-NO.json";
import enGB from "./messages/en-GB.json";

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
 */
export function createTranslator(locale: SupportedLocale) {
  const messages = MESSAGE_SETS[locale];
  return function t(
    key: string,
    values?: Record<string, string | number | Date>
  ): string {
    const raw = messages[key];
    if (raw === undefined) {
      logMissingKey(key, [locale]);
      const platformRaw = MESSAGE_SETS[PLATFORM_DEFAULT_LOCALE][key];
      return platformRaw !== undefined ? format(platformRaw, PLATFORM_DEFAULT_LOCALE, values) : "…";
    }
    return format(raw, locale, values);
  };
}
