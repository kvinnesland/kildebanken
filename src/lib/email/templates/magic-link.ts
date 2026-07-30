import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { SITE_ORIGIN } from "../digest";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Innloggingslenke" (SPEC-V1.md 15) — sendes ved alle innlogginger UNNTATT
 * den aller første (som bruker `confirm_email`/
 * `journalist_application_received` i stedet, se `magic-link.ts` sin egen
 * `requestMagicLink()`-kommentar). Lenken peker på `GET /api/auth/verify`
 * (URL-formatet er definert der, se den filens kommentar) — IKKE
 * `/logg-inn/bekreft` eller noe tilsvarende, siden selve økt-opprettelsen
 * må skje i en Route Handler, ikke en side.
 */
export function renderMagicLinkEmail(locale: SupportedLocale, token: string): RenderedEmail {
  const t = createTranslator(locale);
  const verifyUrl = `${SITE_ORIGIN}/api/auth/verify?token=${encodeURIComponent(token)}&locale=${locale}`;

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.magic_link.subject"),
    heading: t("email.magic_link.heading"),
    body: t("email.magic_link.body"),
    ctaLabel: t("email.magic_link.cta"),
    ctaUrl: verifyUrl,
    ignoreNote: t("email.magic_link.ignore"),
  });
}
