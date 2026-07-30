import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { SITE_ORIGIN } from "../digest";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Nytt svar mottatt" (SPEC-V1.md 15) — sendes til JOURNALISTEN rett etter
 * `submitResponse()`. Lenker til forespørselens EGEN offentlige side som en
 * midlertidig destinasjon — journalistens svarinnboks (SPEC-V1.md 13, "per
 * forespørsel vises antall svar, antall uleste og status/frist") er IKKE
 * bygget ennå, se NATTLOGG.md. Oppdater denne lenken til den faktiske
 * innboksen den dagen den finnes.
 */
export function renderNewResponseReceivedEmail(
  locale: SupportedLocale,
  requestId: string,
  requestTitle: string,
  requestSlug: string
): RenderedEmail {
  const t = createTranslator(locale);
  const requestUrl = `${SITE_ORIGIN}/${locale}/foresporsler/${requestId}/${requestSlug}`;

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.new_response_received.subject"),
    heading: t("email.new_response_received.heading"),
    body: t("email.new_response_received.body", { title: requestTitle }),
    ctaLabel: t("email.new_response_received.cta"),
    ctaUrl: requestUrl,
  });
}
