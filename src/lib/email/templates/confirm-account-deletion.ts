import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { SITE_ORIGIN } from "../digest";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Bekreft kontosletting" (SPEC-V1.md 15) — steg 1 av 2 i
 * `src/lib/auth/account-deletion.ts`. Peker til
 * `/[locale]/me/slett-konto?token=...`, IKKE `GET /api/auth/verify` som
 * magic_link/confirm_email — denne siden kaller `POST /me/confirm-deletion`
 * klientside i stedet for å sette en cookie, så den trenger ikke være en
 * Route Handler (se account-deletion.ts: tokenet alene er autoriteten,
 * ingen aktiv økt kreves for å bekrefte).
 */
export function renderConfirmAccountDeletionEmail(
  locale: SupportedLocale,
  token: string,
  countryDefaultLocale?: SupportedLocale
): RenderedEmail {
  const t = createTranslator(locale, countryDefaultLocale);
  const confirmUrl = `${SITE_ORIGIN}/${locale}/me/slett-konto?token=${encodeURIComponent(token)}`;

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.confirm_account_deletion.subject"),
    heading: t("email.confirm_account_deletion.heading"),
    body: t("email.confirm_account_deletion.body"),
    ctaLabel: t("email.confirm_account_deletion.cta"),
    ctaUrl: confirmUrl,
    ignoreNote: t("email.confirm_account_deletion.ignore"),
  });
}
