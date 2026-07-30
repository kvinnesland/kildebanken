import { SUPPORTED_LOCALES, type SupportedLocale } from "./config";

/**
 * SPEC-V1.md 3.7: "Offentlige sider prefikses med full locale-tag" og har
 * EGNE, oversatte stinavn per locale — ikke bare en oversatt slug:
 *
 *   /nb-NO/foresporsler/:id/soker-personer-som-har-byttet-karriere
 *   /en-GB/requests/:id/looking-for-people-who-changed-careers
 *
 * Det faktiske mappenavnet i src/app/[locale]/... er "foresporsler"/"svar"
 * (nb-NO sine egne ord, siden det var v1s eneste locale da ruten ble bygget,
 * se 26.1 punkt 2) — dette var et reelt hull frem til nå: alle locales
 * serverte samme nb-NO-ord i URL-en. `middleware.ts` oversetter mellom disse
 * to tabellene og det faktiske mappenavnet (rewrite for en-GB sitt eget ord,
 * redirect for feil locales ord), se `resolveLocalizedRequestPath()` der.
 *
 * "Svar"/"respond"-segmentet er IKKE nevnt eksplisitt i 3.7s eksempel (som
 * bare viser toppsegmentet) — oversettelsen "respond" er en antagelse tatt
 * her, konsistent med den eksisterende knappeteksten
 * (`request.respond_button` → "Respond" i en-GB.json), notert i
 * NATTLOGG.md.
 */
const REQUESTS_SEGMENT: Record<SupportedLocale, string> = {
  "nb-NO": "foresporsler",
  "en-GB": "requests",
};

const RESPOND_SEGMENT: Record<SupportedLocale, string> = {
  "nb-NO": "svar",
  "en-GB": "respond",
};

/** Det faktiske mappenavnet under src/app/[locale]/ — se filkommentaren over. */
export const REQUESTS_FOLDER_SEGMENT = REQUESTS_SEGMENT["nb-NO"];
export const RESPOND_FOLDER_SEGMENT = RESPOND_SEGMENT["nb-NO"];

export function requestDetailPath(locale: SupportedLocale, id: string, slug: string): string {
  return `/${locale}/${REQUESTS_SEGMENT[locale]}/${id}/${slug}`;
}

export function requestRespondPath(locale: SupportedLocale, id: string): string {
  return `/${locale}/${REQUESTS_SEGMENT[locale]}/${id}/${RESPOND_SEGMENT[locale]}`;
}

/**
 * Finner hvilken locale et gitt "requests"-segmentord egentlig tilhører
 * (uansett hvilken locale ordet faktisk ble brukt UNDER) — brukt av
 * `middleware.ts` til å avgjøre om et innkommende segment er riktig ord for
 * gjeldende locale (→ rewrite til faktisk mappenavn), et ANNET locales ord
 * (→ redirect til riktig ord), eller ikke en forespørsel-sti i det hele tatt
 * (→ uendret).
 */
export function localeForRequestsSegment(segment: string): SupportedLocale | undefined {
  return SUPPORTED_LOCALES.find((locale) => REQUESTS_SEGMENT[locale] === segment);
}

export function requestsSegmentFor(locale: SupportedLocale): string {
  return REQUESTS_SEGMENT[locale];
}

export function respondSegmentFor(locale: SupportedLocale): string {
  return RESPOND_SEGMENT[locale];
}

export interface LocalizedRequestPathAction {
  kind: "rewrite" | "redirect";
  pathname: string;
}

/**
 * Ren, testbar kjernelogikk for `middleware.ts`. `pathname` er ALLEREDE
 * locale-prefikset (f.eks. `/en-GB/requests/abc/my-slug`) — kalleren har
 * allerede bekreftet at stien starter med en kjent locale.
 *
 * - En locales EGET ord, men det avviker fra det faktiske mappenavnet
 *   (en-GB sitt "requests" er ikke mappen `foresporsler`) → `"rewrite"`:
 *   URL-en i adresselinjen skal IKKE endres, bare hvilken faktisk rute
 *   Next.js slår opp internt.
 * - En ANNEN locales ord brukt under denne locale-en (f.eks.
 *   `/nb-NO/requests/...` eller `/en-GB/foresporsler/...`) → `"redirect"`:
 *   306/308 til riktig ord for DENNE locale-en, siden 3.7 krever nøyaktig
 *   én kanonisk URL per locale-variant.
 * - Ikke en forespørsel-sti i det hele tatt (feil antall segmenter, eller
 *   toppsegmentet matcher ingen kjent locales ord) → `undefined`, uendret.
 */
export function resolveLocalizedRequestPath(
  pathname: string,
  locale: SupportedLocale
): LocalizedRequestPathAction | undefined {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 3 || parts[0] !== locale) return undefined;

  const seg1 = parts[1];
  if (!seg1) return undefined;
  const matchedLocale = localeForRequestsSegment(seg1);
  if (!matchedLocale) return undefined;

  const newParts = [...parts];

  if (matchedLocale === locale) {
    if (seg1 === REQUESTS_FOLDER_SEGMENT) return undefined;
    newParts[1] = REQUESTS_FOLDER_SEGMENT;
    if (parts[3] === respondSegmentFor(locale)) newParts[3] = RESPOND_FOLDER_SEGMENT;
    return { kind: "rewrite", pathname: `/${newParts.join("/")}` };
  }

  newParts[1] = requestsSegmentFor(locale);
  if (parts[3] === respondSegmentFor(matchedLocale)) newParts[3] = respondSegmentFor(locale);
  return { kind: "redirect", pathname: `/${newParts.join("/")}` };
}
