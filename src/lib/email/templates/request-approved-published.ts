import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { SITE_ORIGIN } from "../digest";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Forespørsel godkjent og publisert" (SPEC-V1.md 15) — sendt til
 * journalisten fra `publishRequest()` (src/lib/moderation/requests.ts).
 * Lenker til forespørselens offentlige side, samme rute som digesten og
 * `response_submitted_receipt` bruker.
 */
export function renderRequestApprovedPublishedEmail(
  locale: SupportedLocale,
  requestId: string,
  requestTitle: string,
  requestSlug: string
): RenderedEmail {
  const t = createTranslator(locale);
  const requestUrl = `${SITE_ORIGIN}/${locale}/foresporsler/${requestId}/${requestSlug}`;

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.request_approved_published.subject"),
    heading: t("email.request_approved_published.heading"),
    body: t("email.request_approved_published.body", { title: requestTitle }),
    ctaLabel: t("email.request_approved_published.cta"),
    ctaUrl: requestUrl,
  });
}
