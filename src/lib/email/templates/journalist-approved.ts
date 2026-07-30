import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { SITE_ORIGIN } from "../digest";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Journalistkonto godkjent" (SPEC-V1.md 15) — sendes fra
 * `approveJournalist()` (src/lib/moderation/journalists.ts). CTA-en peker
 * på innloggingssiden (`/[locale]/logg-inn`), ikke `GET /api/auth/verify` —
 * det finnes ikke noe token her, godkjenningen er ikke en klikkbar handling,
 * bare en beskjed om at kontoen nå kan brukes.
 */
export function renderJournalistApprovedEmail(locale: SupportedLocale): RenderedEmail {
  const t = createTranslator(locale);

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.journalist_approved.subject"),
    heading: t("email.journalist_approved.heading"),
    body: t("email.journalist_approved.body"),
    ctaLabel: t("email.journalist_approved.cta"),
    ctaUrl: `${SITE_ORIGIN}/${locale}/logg-inn`,
  });
}
