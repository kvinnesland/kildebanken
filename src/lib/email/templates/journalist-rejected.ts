import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Journalistkonto avvist, med begrunnelse" (SPEC-V1.md 15/8) — sendes fra
 * `rejectJournalist()` (src/lib/moderation/journalists.ts). `reason`
 * skrives i fritekst av moderator og oversettes ikke (samme prinsipp som
 * moderator-kommentarer på forespørsler, 9.3) — satt inn i den oversatte
 * body-teksten via ICU-interpolasjon, ikke lagt til som en egen HTML-blokk.
 * Ingen CTA: en avvist søknad har ingen selvbetjent oppfølgingshandling.
 */
export function renderJournalistRejectedEmail(
  locale: SupportedLocale,
  reason: string
): RenderedEmail {
  const t = createTranslator(locale);

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.journalist_rejected.subject"),
    heading: t("email.journalist_rejected.heading"),
    body: t("email.journalist_rejected.body", { reason }),
  });
}
