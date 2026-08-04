import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Kontakt avslått" (SPEC-V1.md 14.2, 15) — sendt til JOURNALISTEN.
 * "Ved avslag varsles journalisten UTEN BEGRUNNELSE" (14.2, ordrett) — ingen
 * `reason`-data sendes med, og ingen CTA (ingenting igjen å gjøre noe med,
 * samme begrunnelse som `journalist_rejected`).
 */
export function renderContactDeclinedEmail(locale: SupportedLocale, countryDefaultLocale?: SupportedLocale): RenderedEmail {
  const t = createTranslator(locale, countryDefaultLocale);

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.contact_declined.subject"),
    heading: t("email.contact_declined.heading"),
    body: t("email.contact_declined.body"),
  });
}
