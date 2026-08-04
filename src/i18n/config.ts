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

/**
 * SPEC-V1.md 12.3: bekreftelsesskjermen før et svar sendes inn er
 * "juridisk relevant og skal gjennomgås av jurist i hvert språk den tilbys
 * på. Den faller ikke tilbake til et annet språk – mangler den, kan ikke
 * locale-en tilbys i landet." Dette er et EKSPLISITT unntak fra 21.3s
 * ellers gjeldende regel om at en manglende oversettelse i et annet språk
 * enn plattformens standardspråk bare gir en advarsel og en 3.4-reservevei
 * (se `createTranslator()`/`resolveMessage()`, get-messages.ts) — for
 * NETTOPP disse nøklene skal en reserve ALDRI faktisk vises, siden
 * meningsinnholdet er juridisk vurdert per språk, ikke bare tekst som er
 * greit å vise på feil språk midlertidig.
 *
 * Håndhevet i `check-keys.ts` som en HARD byggefeil (ikke bare en advarsel
 * som ellers for 21.3-hull) hvis noen av disse manglestrenger i et
 * SUPPORTED_LOCALES-språk — siden `countries.available_locales` kun kan
 * velges fra nettopp denne listen (`isSupportedLocale()`, se
 * `admin/countries.ts`), garanterer dette strukturelt at INGEN land noen
 * gang kan tilby en locale der denne teksten mangler, uten en egen
 * runtime-sjekk per land.
 */
export const LEGALLY_REVIEWED_TRANSLATION_KEYS = [
  "response.form.confirm_journalist",
  "response.form.confirm_no_guarantee",
  "response.confirm.sharing_none",
  "response.confirm.sharing_email",
  "response.confirm.may_be_quoted",
  "response.confirm.journalist_responsibility",
  "response.confirm.platform_verification",
  "response.confirm.no_withdrawal_from_journalist",
] as const;
