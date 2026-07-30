import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { SITE_ORIGIN } from "../digest";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Forespørsel du har svart på er lukket" (SPEC-V1.md 15) — sendt til
 * RESPONDENTEN fra `closeJournalistContentOnDeletion()`
 * (src/lib/auth/account-deletion.ts, 17.5: "lukkes åpne forespørsler,
 * respondentene varsles"). Lenker til forespørselens offentlige side —
 * fortsatt synlig etter lukking (`PUBLICLY_VISIBLE_STATUSES` inkluderer
 * `closed`, src/lib/requests/requests.ts).
 */
export function renderResponseRequestClosedEmail(
  locale: SupportedLocale,
  requestId: string,
  requestTitle: string,
  requestSlug: string
): RenderedEmail {
  const t = createTranslator(locale);
  const requestUrl = `${SITE_ORIGIN}/${locale}/foresporsler/${requestId}/${requestSlug}`;

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.response_request_closed.subject"),
    heading: t("email.response_request_closed.heading"),
    body: t("email.response_request_closed.body", { title: requestTitle }),
    ctaLabel: t("email.response_request_closed.cta"),
    ctaUrl: requestUrl,
  });
}
