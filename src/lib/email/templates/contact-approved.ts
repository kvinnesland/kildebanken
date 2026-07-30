import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { SITE_ORIGIN } from "../digest";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Kontakt godkjent" (SPEC-V1.md 14.2, 15) — sendt til JOURNALISTEN fra
 * `respondToContactRequest()`. CTA-en peker til samme
 * `/[locale]/contact-requests/:id`-side som `contact_request_received`
 * brukte — `getContactRequestDetail()` viser den delte e-postadressen der
 * for journalisten (kun etter godkjenning), i stedet for å legge selve
 * adressen rått i e-postteksten.
 */
export function renderContactApprovedEmail(
  locale: SupportedLocale,
  contactRequestId: string
): RenderedEmail {
  const t = createTranslator(locale);
  const url = `${SITE_ORIGIN}/${locale}/contact-requests/${contactRequestId}`;

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.contact_approved.subject"),
    heading: t("email.contact_approved.heading"),
    body: t("email.contact_approved.body"),
    ctaLabel: t("email.contact_approved.cta"),
    ctaUrl: url,
  });
}
