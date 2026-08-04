import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { SITE_ORIGIN } from "../digest";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Ny forespørsel til moderering" (SPEC-V1.md 15) — sendt til alle
 * moderatorer tildelt landet, fra `submitRequest()`
 * (src/lib/requests/requests.ts). Lenker til modereringskøen
 * (`/admin/requests`), IKKE til en egen detaljside for forespørselen —
 * det finnes ingen slik rute, køen viser og behandler forespørslene
 * direkte.
 */
export function renderNewRequestForModerationEmail(
  locale: SupportedLocale,
  requestTitle: string,
  countryDefaultLocale?: SupportedLocale
): RenderedEmail {
  const t = createTranslator(locale, countryDefaultLocale);
  const url = `${SITE_ORIGIN}/${locale}/admin/requests`;

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.new_request_for_moderation.subject"),
    heading: t("email.new_request_for_moderation.heading"),
    body: t("email.new_request_for_moderation.body", { title: requestTitle }),
    ctaLabel: t("email.new_request_for_moderation.cta"),
    ctaUrl: url,
  });
}
