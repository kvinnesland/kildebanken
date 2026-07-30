import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { escapeHtml } from "./escape-html";
import { EMAIL_COLORS } from "./colors";

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
export const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://kildebanken.example";

// To ULIKE plassholdere, ikke én — de to lenkene bærer to ulike tokens med
// ulikt formål (SPEC-V1.md 6.2 vs. 24.3/9.3):
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
  requestsForDigest: readonly DigestRequestItem[]
): RenderedDigest {
  const t = createTranslator(locale);
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const subject = t("digest.subject", { count: requestsForDigest.length });

  // Går via byttepunktet i /api/digest-access/[token] (økt 5, SPEC-V1.md
  // 6.2), IKKE direkte til innholdssiden med tokenet i søkestrengen. Grunnen:
  // det endepunktet oppretter en Session (via next/headers cookies()), noe
  // en vanlig Server Component-siderendering ikke kan gjøre — det krever en
  // Route Handler. Se route-filens kommentar for hvorfor dette er trygt mot
  // åpen redirect.
  const requestUrl = (r: DigestRequestItem) => {
    const destination = encodeURIComponent(`/${locale}/foresporsler/${r.id}/${r.slug}`);
    return `${SITE_ORIGIN}/api/digest-access/${ACCESS_TOKEN_PLACEHOLDER}?to=${destination}`;
  };
  const unsubscribeUrl = `${SITE_ORIGIN}/unsubscribe/${UNSUBSCRIBE_TOKEN_PLACEHOLDER}`;

  const itemsHtml = requestsForDigest
    .map((r) => {
      const url = requestUrl(r);
      const languageNotice =
        r.contentLanguage !== locale
          ? `<p style="color:${EMAIL_COLORS.textMuted};font-size:13px;margin:4px 0 0;">${escapeHtml(
              t("request.foreign_language_notice")
            )}</p>`
          : "";
      const geoLine = r.geographicNote
        ? `<p style="color:${EMAIL_COLORS.textMuted};font-size:14px;margin:4px 0 0;">${escapeHtml(r.geographicNote)}</p>`
        : "";

      return `<tr><td style="padding:16px 0;border-bottom:1px solid ${EMAIL_COLORS.border};">
        <h2 style="font-size:18px;margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;">
          <a href="${url}" style="color:${EMAIL_COLORS.link};text-decoration:none;">${escapeHtml(r.title)}</a>
        </h2>
        <p style="margin:0 0 8px;color:${EMAIL_COLORS.text};">${escapeHtml(r.summary)}</p>
        <p style="color:${EMAIL_COLORS.textMuted};font-size:13px;margin:0;">${escapeHtml(r.organizationName)}</p>
        <p style="color:${EMAIL_COLORS.textMuted};font-size:13px;margin:2px 0 0;">${escapeHtml(
          t("request.deadline_label", { deadline: dateFormatter.format(r.responseDeadline) })
        )}</p>
        ${geoLine}${languageNotice}
        <a href="${url}" style="display:inline-block;margin-top:10px;padding:8px 16px;background:${EMAIL_COLORS.accent};color:${EMAIL_COLORS.accentText};text-decoration:none;border-radius:6px;font-size:14px;">${escapeHtml(
          t("digest.cta_read_and_respond")
        )}</a>
      </td></tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${EMAIL_COLORS.pageBackground};font-family:-apple-system,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${EMAIL_COLORS.surface};border-radius:8px;">
        <tr><td style="padding:24px;">
          <p style="margin:0 0 20px;color:${EMAIL_COLORS.text};">${escapeHtml(t("digest.intro"))}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
          <p style="margin:24px 0 0;font-size:12px;color:${EMAIL_COLORS.textMuted};">
            <a href="${unsubscribeUrl}" style="color:${EMAIL_COLORS.textMuted};">${escapeHtml(t("digest.unsubscribe"))}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    t("digest.intro"),
    "",
    ...requestsForDigest.map(
      (r) =>
        `${r.title}\n${r.summary}\n${t("request.deadline_label", {
          deadline: dateFormatter.format(r.responseDeadline),
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

