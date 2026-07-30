import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Forespørsel avvist, med begrunnelse" (SPEC-V1.md 15) — sendt til
 * journalisten fra `rejectRequest()` (src/lib/moderation/requests.ts).
 * `reason` er moderators fritekst (samme prinsipp som `journalist_rejected`).
 * Ingen CTA: `rejected` er endelig (9.2) — ingen selvbetjent
 * oppfølgingshandling, journalisten må opprette en NY forespørsel.
 */
export function renderRequestRejectedEmail(locale: SupportedLocale, reason: string): RenderedEmail {
  const t = createTranslator(locale);

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.request_rejected.subject"),
    heading: t("email.request_rejected.heading"),
    body: t("email.request_rejected.body", { reason }),
  });
}
