import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { SITE_ORIGIN } from "../digest";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Journalistsøknad mottatt" (SPEC-V1.md 15) — den FØRSTE e-posten en
 * journalist får etter `applyAsJournalist()` (src/lib/registration/
 * journalist.ts). Kombinerer bevisst e-postbekreftelse OG søknadskvittering
 * i én e-post (se kommentaren i src/lib/auth/magic-link.ts sin
 * `requestMagicLink()` for hvorfor: SPEC-V1.md 7.2/15 lister dem som to
 * rader i tabellen, men 6.1 sier "e-postadressen verifiseres som en del av
 * innloggingen" — samme mekanisme). Samme
 * `GET /api/auth/verify?token=...&locale=...`-lenke som
 * `magic_link`/`confirm_email`.
 *
 * `verification_status` (JournalistProfile, 19.5/8.1) settes til
 * `pending_review` idet søknaden opprettes, UAVHENGIG av om denne
 * e-posten i det hele tatt klikkes — teksten forklarer dette ("blir
 * deretter gjennomgått"), ikke at bekreftelse UTLØSER gjennomgangen.
 */
export function renderJournalistApplicationReceivedEmail(
  locale: SupportedLocale,
  token: string,
  countryDefaultLocale?: SupportedLocale
): RenderedEmail {
  const t = createTranslator(locale, countryDefaultLocale);
  const verifyUrl = `${SITE_ORIGIN}/api/auth/verify?token=${encodeURIComponent(token)}&locale=${locale}`;

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.journalist_application_received.subject"),
    heading: t("email.journalist_application_received.heading"),
    body: t("email.journalist_application_received.body"),
    ctaLabel: t("email.journalist_application_received.cta"),
    ctaUrl: verifyUrl,
    ignoreNote: t("email.journalist_application_received.ignore"),
  });
}
