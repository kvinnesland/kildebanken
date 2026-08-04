import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { SITE_ORIGIN } from "../digest";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Bekreft e-postadresse" (SPEC-V1.md 15) — den aller FØRSTE e-posten en
 * mottaker (ikke journalist, se `journalist_application_received`) får
 * etter registrering (`registerRecipient()`, src/lib/registration/
 * recipient.ts). Samme underliggende token/lenke-mekanisme som
 * `magic_link` (se `requestMagicLink()`), bare med en tekst som forklarer
 * at dette FØRSTE klikket bekrefter adressen — SPEC-V1.md 6.1: "Vellykket
 * innlogging setter email_verified_at dersom den er tom."
 */
export function renderConfirmEmailEmail(locale: SupportedLocale, token: string, countryDefaultLocale?: SupportedLocale): RenderedEmail {
  const t = createTranslator(locale, countryDefaultLocale);
  const verifyUrl = `${SITE_ORIGIN}/api/auth/verify?token=${encodeURIComponent(token)}&locale=${locale}`;

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.confirm_email.subject"),
    heading: t("email.confirm_email.heading"),
    body: t("email.confirm_email.body"),
    ctaLabel: t("email.confirm_email.cta"),
    ctaUrl: verifyUrl,
    ignoreNote: t("email.confirm_email.ignore"),
  });
}
