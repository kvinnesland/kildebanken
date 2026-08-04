import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { SITE_ORIGIN } from "../digest";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Forespørsel utløper om 24 timer" (SPEC-V1.md 15) — sendt til
 * journalisten fra `runDeadlineReminders()` (src/lib/jobs/tick.ts),
 * idempotent via `deadlineReminderSentAt`. Lenker til journalistens egen
 * side for forespørselen.
 */
export function renderDeadlineApproaching24hEmail(
  locale: SupportedLocale,
  requestId: string,
  title: string,
  countryDefaultLocale?: SupportedLocale
): RenderedEmail {
  const t = createTranslator(locale, countryDefaultLocale);
  const url = `${SITE_ORIGIN}/${locale}/journalist/requests/${requestId}`;

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.deadline_approaching_24h.subject"),
    heading: t("email.deadline_approaching_24h.heading"),
    body: t("email.deadline_approaching_24h.body", { title }),
    ctaLabel: t("email.deadline_approaching_24h.cta"),
    ctaUrl: url,
  });
}
