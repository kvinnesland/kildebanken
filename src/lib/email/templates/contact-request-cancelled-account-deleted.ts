import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Kontaktforespørsel kansellert (respondentens konto slettet)"
 * (SPEC-V1.md 15) — sendt til JOURNALISTEN fra `anonymizeRecipientContent()`
 * (src/lib/auth/account-deletion.ts, 17.5). Ingen CTA: respondentens konto
 * er slettet, det finnes ingenting igjen å handle på (samme begrunnelse
 * som `contact_declined`/`journalist_rejected`).
 */
export function renderContactRequestCancelledAccountDeletedEmail(locale: SupportedLocale): RenderedEmail {
  const t = createTranslator(locale);

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.contact_request_cancelled_account_deleted.subject"),
    heading: t("email.contact_request_cancelled_account_deleted.heading"),
    body: t("email.contact_request_cancelled_account_deleted.body"),
  });
}
