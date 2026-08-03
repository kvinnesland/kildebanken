import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { requestDetailPath } from "@/i18n/localized-paths";
import { escapeHtml } from "./escape-html";
import { EMAIL_COLOR_SCHEME_META, EMAIL_COLORS, emailDarkModeStyleTag } from "./colors";

export interface DigestRequestItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  organizationName: string;
  responseDeadline: Date;
  geographicNote: string | null;
  contentLanguage: string;
}

export interface RenderedDigest {
  subject: string;
  html: string;
  text: string;
}

// Egen driftskonfigurasjon, ikke en produktbeslutning — settes til faktisk
// domene ved deploy. Se .env.example. Eksportert (ikke bare brukt her) slik
// at tick.ts kan bygge List-Unsubscribe-headeren (FR-038) fra samme
// opprinnelse, uten å duplisere fallback-verdien to steder.
//
// Plassholderdomenet under er BEVISST et ikke-oppløsbart eksempeldomene
// (RFC 2606, samme konvensjon som testenes @example.invalid) for lokal
// utvikling/tester uten `.env`-oppsett — MEN uten sperren under ville et
// glemt `NEXT_PUBLIC_SITE_ORIGIN` i en EKTE driftsatt miljø stille bakt
// dette plassholderdomenet inn i HVER lenke i HVER utsendte e-post
// (innloggingslenke, e-postbekreftelse, kontosletting-bekreftelse,
// kontaktforespørsel-godkjenning, digest-lenker — alle 15+ malene som
// importerer `SITE_ORIGIN`), og gjort samtlige e-post-baserte handlinger
// ubrukelige uten noen synlig feil noe sted (selve sendingen ville
// lykkes, bare med en lenke som ikke fører noe sted). Samme bugklasse
// som `BREVO_API_KEY`-sperren i `send.ts` (se NATTLOGG.md) — men
// alvorligere, siden DENNE feilen aldri ville vist seg som en logget
// feilmelding i det hele tatt.
export function resolveSiteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_ORIGIN;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_SITE_ORIGIN mangler i produksjon — nekter å falle tilbake til plassholderdomenet https://kildebanken.example, som ville gjort ALLE lenker i utsendte e-poster ubrukelige (se INFRASTRUCTURE.md 9 og NATTLOGG.md)."
    );
  }
  return "https://kildebanken.example";
}

export const SITE_ORIGIN = resolveSiteOrigin();

// To ULIKE plassholdere, ikke én — de to lenkene bærer to ulike tokens med
// ulikt formål (SPEC-V1.md 6.2 vs. 10.3):
//  - tilgangstoken: gir en innlogget økt, ett per mottaker per utsendelse
//  - avmeldingstoken: virker UTEN innlogging, roteres ved hver utsendelse
//    (se insertPerRecipientTokens og tick.ts — det er derfor det er
//    "tilbakekallbart": forrige e-posts avmeldingslenke slutter å virke når
//    en ny genereres, ikke fordi noen aktivt tilbakekaller den)
const ACCESS_TOKEN_PLACEHOLDER = "__ACCESS_TOKEN__";
const UNSUBSCRIBE_TOKEN_PLACEHOLDER = "__UNSUBSCRIBE_TOKEN__";

/**
 * Rendrer den daglige digesten ÉN gang per locale i bruk i landet (FR-032),
 * ikke én gang per mottaker. Lenkene inneholder plassholdere for de to
 * per-mottaker-tokenene — kalleren (tick.ts) gjør et billig strengbytte per
 * mottaker etterpå (`insertPerRecipientTokens`) i stedet for å rendre på
 * nytt for hver av dem.
 *
 * DESIGN.md 7 sin fulle byggetids-eksport av tokens til e-post er IKKE
 * bygget ennå — fargeverdiene kommer fra `./colors.ts` (`EMAIL_COLORS`),
 * beregnet med samme oklch→hex-matematikk som WCAG-kontrasttesten bruker,
 * og selv sjekket mot de faktiske primitivene i `colors.test.ts` — den
 * nærmeste tilnærmingen til "feiler CI ved avvik" uten hele pipelinen. Se
 * NATTLOGG.md (økt 7 rettet en reell drift her: de opprinnelige,
 * håndskrevne verdiene i denne filen stemte ikke lenger med de faktiske
 * tokenene).
 */
export function renderDigestContent(
  locale: SupportedLocale,
  requestsForDigest: readonly DigestRequestItem[],
  countryTimezone: string,
  // "YYYY-MM-DD", landets lokale kalenderdato for denne utsendelsen
  // (samme verdi som Digest.scheduledFor, 19.9) — IKKE en Date/klokkeslett,
  // siden dette er en ren kalenderdag, uavhengig av klokkeslett.
  digestDate: string
): RenderedDigest {
  const t = createTranslator(locale);
  // SPEC-V1.md 10.2: digestens innhold skal inkludere "dato, formatert for
  // mottakerens locale" som et EGET element, atskilt fra "antall nye
  // forespørsler" (subject) og introen — reelt hull frem til nå: verken
  // HTML- eller ren-tekst-varianten viste noen faktisk dato noe sted, kun
  // den relative frasen "i dag" i emnefeltet (se NATTLOGG.md). `timeZone:
  // "UTC"` her er bevisst — `digestDate` er allerede landets egen lokale
  // kalenderdag (beregnet i tick.ts sin `localTimeForTimezone()`), så den
  // skal vises SLIK DEN ER, ikke tolkes på nytt inn i en annen tidssone.
  const formattedDigestDate = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${digestDate}T00:00:00Z`));
  // SPEC-V1.md 3.6/10.2: "Svarfrister vises alltid med tidssone angitt" —
  // formatert i LANDETS tidssone (samme kilde som selve utsendelsen
  // planlegges etter, tick.ts sin `localTimeForTimezone`), ikke serverens
  // egen, ambigue lokale tidssone. Samme mønster (formater + vis IANA-
  // navnet i parentes) som request-detaljsiden ([slug]/page.tsx) — reelt
  // hull frem til nå: denne funksjonen tok ikke imot noen tidssone i det
  // hele tatt (se NATTLOGG.md).
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: countryTimezone,
  });
  const formatDeadline = (deadline: Date) => `${dateFormatter.format(deadline)} (${countryTimezone})`;

  const subject = t("digest.subject", { count: requestsForDigest.length });

  // Går via byttepunktet i /api/digest-access/[token] (økt 5, SPEC-V1.md
  // 6.2), IKKE direkte til innholdssiden med tokenet i søkestrengen. Grunnen:
  // det endepunktet oppretter en Session (via next/headers cookies()), noe
  // en vanlig Server Component-siderendering ikke kan gjøre — det krever en
  // Route Handler. Se route-filens kommentar for hvorfor dette er trygt mot
  // åpen redirect.
  const requestUrl = (r: DigestRequestItem) => {
    const destination = encodeURIComponent(requestDetailPath(locale, r.id, r.slug));
    return `${SITE_ORIGIN}/api/digest-access/${ACCESS_TOKEN_PLACEHOLDER}?to=${destination}`;
  };
  const unsubscribeUrl = `${SITE_ORIGIN}/unsubscribe/${UNSUBSCRIBE_TOKEN_PLACEHOLDER}`;

  const itemsHtml = requestsForDigest
    .map((r) => {
      const url = requestUrl(r);
      const languageNotice =
        r.contentLanguage !== locale
          ? `<p class="eb-muted" style="color:${EMAIL_COLORS.textMuted};font-size:13px;margin:4px 0 0;">${escapeHtml(
              t("request.foreign_language_notice")
            )}</p>`
          : "";
      const geoLine = r.geographicNote
        ? `<p class="eb-muted" lang="${r.contentLanguage}" style="color:${EMAIL_COLORS.textMuted};font-size:14px;margin:4px 0 0;">${escapeHtml(r.geographicNote)}</p>`
        : "";

      return `<tr><td class="eb-border" style="padding:16px 0;border-bottom:1px solid ${EMAIL_COLORS.border};">
        <h2 lang="${r.contentLanguage}" style="font-size:18px;margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;">
          <a href="${url}" class="eb-link" style="color:${EMAIL_COLORS.link};text-decoration:none;">${escapeHtml(r.title)}</a>
        </h2>
        <p class="eb-text" lang="${r.contentLanguage}" style="margin:0 0 8px;color:${EMAIL_COLORS.text};">${escapeHtml(r.summary)}</p>
        <p class="eb-muted" style="color:${EMAIL_COLORS.textMuted};font-size:13px;margin:0;">${escapeHtml(r.organizationName)}</p>
        <p class="eb-muted" style="color:${EMAIL_COLORS.textMuted};font-size:13px;margin:2px 0 0;">${escapeHtml(
          t("request.deadline_label", { deadline: formatDeadline(r.responseDeadline) })
        )}</p>
        ${geoLine}${languageNotice}
        <a href="${url}" class="eb-button" style="display:inline-block;margin-top:10px;padding:8px 16px;background:${EMAIL_COLORS.accent};color:${EMAIL_COLORS.accentText};text-decoration:none;border-radius:6px;font-size:14px;">${escapeHtml(
          t("digest.cta_read_and_respond")
        )}</a>
      </td></tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${EMAIL_COLOR_SCHEME_META}${emailDarkModeStyleTag()}</head>
<body class="eb-body" style="margin:0;padding:0;background:${EMAIL_COLORS.pageBackground};font-family:-apple-system,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="eb-card" style="max-width:600px;width:100%;background:${EMAIL_COLORS.surface};border-radius:8px;">
        <tr><td style="padding:24px;">
          <p class="eb-muted" style="margin:0 0 4px;font-size:13px;color:${EMAIL_COLORS.textMuted};">${escapeHtml(formattedDigestDate)}</p>
          <p class="eb-text" style="margin:0 0 20px;color:${EMAIL_COLORS.text};">${escapeHtml(t("digest.intro"))}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
          <p class="eb-muted" style="margin:24px 0 0;font-size:12px;color:${EMAIL_COLORS.textMuted};">
            <a href="${unsubscribeUrl}" class="eb-muted" style="color:${EMAIL_COLORS.textMuted};">${escapeHtml(t("digest.unsubscribe"))}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    formattedDigestDate,
    t("digest.intro"),
    "",
    ...requestsForDigest.map(
      (r) =>
        `${r.title}\n${r.summary}\n${t("request.deadline_label", {
          deadline: formatDeadline(r.responseDeadline),
        })}\n${requestUrl(r)}\n`
    ),
    `${t("digest.unsubscribe")}: ${unsubscribeUrl}`,
  ].join("\n");

  return { subject, html, text };
}

/**
 * Setter inn de to per-mottaker-tokenene i en ferdig rendret digest. Dette
 * er det billige steget som faktisk gjøres én gang per mottaker — selve
 * rendringen over skjer bare én gang per locale (FR-032).
 */
export function insertPerRecipientTokens(
  rendered: RenderedDigest,
  accessToken: string,
  unsubscribeToken: string
): RenderedDigest {
  const replace = (s: string) =>
    s
      .replaceAll(ACCESS_TOKEN_PLACEHOLDER, accessToken)
      .replaceAll(UNSUBSCRIBE_TOKEN_PLACEHOLDER, unsubscribeToken);

  return { subject: rendered.subject, html: replace(rendered.html), text: replace(rendered.text) };
}

