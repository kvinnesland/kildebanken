import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { SITE_ORIGIN } from "../digest";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Forespørsel har vært åpen lenge (30 dager)" (SPEC-V1.md 9.2, 15) — sendt
 * til journalisten fra `runStaleRequestReminders()` (src/lib/jobs/tick.ts),
 * idempotent via `staleReminderSentAt`. 9.2 er eksplisitt: "med lenke til å
 * lukke den" — lenker derfor til journalistens egen side, som viser
 * "Lukk forespørselen"-knappen (`CloseRequestAction.tsx`) for publiserte
 * forespørsler. INGEN automatisk lukking (9.2, samme avsnitt).
 */
export function renderStaleRequestReminder30dEmail(
  locale: SupportedLocale,
  requestId: string,
  title: string,
  countryDefaultLocale?: SupportedLocale
): RenderedEmail {
  const t = createTranslator(locale, countryDefaultLocale);
  const url = `${SITE_ORIGIN}/${locale}/journalist/requests/${requestId}`;

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.stale_request_reminder_30d.subject"),
    heading: t("email.stale_request_reminder_30d.heading"),
    body: t("email.stale_request_reminder_30d.body", { title }),
    ctaLabel: t("email.stale_request_reminder_30d.cta"),
    ctaUrl: url,
  });
}
