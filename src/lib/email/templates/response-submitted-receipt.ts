import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { requestDetailPath } from "@/i18n/localized-paths";
import { SITE_ORIGIN } from "../digest";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Kvittering på innsendt svar" (SPEC-V1.md 15) — sendes til RESPONDENTEN
 * rett etter `submitResponse()` (src/lib/responses/responses.ts). Lenker
 * til forespørselens egen offentlige side (samme rute som digest-lenken
 * bruker), IKKE til selve svaret — respondenten har ingen egen side for å
 * se sitt eget svar igjen i v1 (ingen slik funksjon er spesifisert).
 */
export function renderResponseSubmittedReceiptEmail(
  locale: SupportedLocale,
  requestId: string,
  requestTitle: string,
  requestSlug: string,
  countryDefaultLocale?: SupportedLocale
): RenderedEmail {
  const t = createTranslator(locale, countryDefaultLocale);
  const requestUrl = `${SITE_ORIGIN}${requestDetailPath(locale, requestId, requestSlug)}`;

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.response_submitted_receipt.subject"),
    heading: t("email.response_submitted_receipt.heading"),
    body: t("email.response_submitted_receipt.body", { title: requestTitle }),
    ctaLabel: t("email.response_submitted_receipt.cta"),
    ctaUrl: requestUrl,
  });
}
