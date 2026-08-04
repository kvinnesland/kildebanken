import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { SITE_ORIGIN } from "../digest";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Forespørsel lukket" (SPEC-V1.md 9.2, 15) — sendt til journalisten fra
 * `closeRequest()` (src/lib/requests/requests.ts), uansett om det var
 * journalisten selv eller en moderator/administrator som lukket den (samme
 * underliggende funksjon for begge, se `POST /requests/:id/close` og
 * `POST /admin/requests/:id/close`). CTA-en peker på journalistens egen
 * redigeringsside, som viser en skrivebeskyttet oppsummering for lukkede
 * forespørsler.
 */
export function renderRequestClosedEmail(
  locale: SupportedLocale,
  requestId: string,
  title: string,
  countryDefaultLocale?: SupportedLocale
): RenderedEmail {
  const t = createTranslator(locale, countryDefaultLocale);
  const url = `${SITE_ORIGIN}/${locale}/journalist/requests/${requestId}`;

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.request_closed.subject"),
    heading: t("email.request_closed.heading"),
    body: t("email.request_closed.body", { title }),
    ctaLabel: t("email.request_closed.cta"),
    ctaUrl: url,
  });
}
