import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { SITE_ORIGIN } from "../digest";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Forespørsel om videre kontakt" (SPEC-V1.md 14.1, 15) — sendt til
 * RESPONDENTEN fra `createContactRequest()`. Peker til
 * `/[locale]/contact-requests/:id`, den samme siden journalisten senere
 * bruker for å se den delte e-postadressen (`contact_approved`) — én side,
 * to roller, se sidens egen kommentar.
 */
export function renderContactRequestReceivedEmail(
  locale: SupportedLocale,
  contactRequestId: string,
  requestTitle: string,
  journalistName: string,
  organizationName: string
): RenderedEmail {
  const t = createTranslator(locale);
  const url = `${SITE_ORIGIN}/${locale}/contact-requests/${contactRequestId}`;

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.contact_request_received.subject"),
    heading: t("email.contact_request_received.heading"),
    body: t("email.contact_request_received.body", { journalistName, organizationName, requestTitle }),
    ctaLabel: t("email.contact_request_received.cta"),
    ctaUrl: url,
  });
}
