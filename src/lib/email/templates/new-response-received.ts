import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { SITE_ORIGIN } from "../digest";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Nytt svar mottatt" (SPEC-V1.md 15) — sendes til JOURNALISTEN rett etter
 * `submitResponse()`. Lenker til journalistens egen svarinnboks for
 * forespørselen (SPEC-V1.md 13, `/journalist/requests/:id/responses`), ikke
 * forespørselens offentlige side — den lenken ble brukt midlertidig før
 * innboksen var bygget, se NATTLOGG.md (rettet her, samme økt som
 * `request_closed`).
 */
export function renderNewResponseReceivedEmail(
  locale: SupportedLocale,
  requestId: string,
  requestTitle: string
): RenderedEmail {
  const t = createTranslator(locale);
  const requestUrl = `${SITE_ORIGIN}/${locale}/journalist/requests/${requestId}/responses`;

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.new_response_received.subject"),
    heading: t("email.new_response_received.heading"),
    body: t("email.new_response_received.body", { title: requestTitle }),
    ctaLabel: t("email.new_response_received.cta"),
    ctaUrl: requestUrl,
  });
}
