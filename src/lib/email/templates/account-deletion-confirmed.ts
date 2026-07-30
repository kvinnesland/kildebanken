import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Kontosletting bekreftet" (SPEC-V1.md 15) — steg 2 av 2, sendt fra
 * `performAccountDeletion()` FØR selve anonymiseringen (mens den ekte
 * e-postadressen fortsatt er kjent). Ingen CTA — det er ingenting igjen å
 * gjøre noe med, samme begrunnelse som `journalist_rejected`.
 */
export function renderAccountDeletionConfirmedEmail(locale: SupportedLocale): RenderedEmail {
  const t = createTranslator(locale);

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.account_deletion_confirmed.subject"),
    heading: t("email.account_deletion_confirmed.heading"),
    body: t("email.account_deletion_confirmed.body"),
  });
}
