// Sentral i18n-konfigurasjon. Se SPEC-V1.md seksjon 3 (spesielt 3.4
// fallback-kjeden og 26.1 punkt 2 for standardspråket).
//
// VIKTIG: locale (språk) og land er to uavhengige akser (SPEC-V1.md 3.1).
// Denne filen styrer BARE hvilke locales plattformen i det hele tatt vet
// hvordan den skal rendre grensesnitt på. Hvilke locales som er
// tilgjengelige i et gitt LAND kommer fra `countries.available_locales` i
// databasen (src/db/schema.ts), ikke herfra.

/**
 * Plattformens standardspråk — siste ledd i fallback-kjeden i 3.4.
 * Besluttet i SPEC-V1.md 26.1 punkt 2: `nb-NO` for v1, fordi det er ett
 * marked og ett språk ved lansering. Revurder når land nummer to legges til.
 *
 * Denne skal IKKE endres per miljø (derfor ikke lest fra process.env her,
 * bare speilet dit for dokumentasjons skyld i .env.example) — det er en
 * produktbeslutning, ikke konfigurasjon.
 */
export const PLATFORM_DEFAULT_LOCALE = "nb-NO" as const;

/** Alle locales plattformen har oversettelsesfiler for, uavhengig av land. */
export const SUPPORTED_LOCALES = ["nb-NO", "en-GB"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
