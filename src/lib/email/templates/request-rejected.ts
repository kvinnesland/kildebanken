import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Forespørsel avvist, med begrunnelse" (SPEC-V1.md 15) — sendt til
 * journalisten fra `rejectRequest()` (src/lib/moderation/requests.ts).
 * `reason` er moderators fritekst (samme prinsipp som `journalist_rejected`).
 * Ingen CTA: `rejected` er endelig (9.2) — ingen selvbetjent
 * oppfølgingshandling, journalisten må opprette en NY forespørsel.
 *
 * `title` inkludert i teksten (samme mønster som
 * `request_approved_published`s «{title}»): uten CTA-lenke til å
 * disambiguere, og uten noe tak på hvor mange forespørsler en journalist
 * kan ha `submitted` samtidig (FR-029s 5-grense gjelder kun `published`),
 * ville en journalist med flere ventende forespørsler ikke kunne se HVILKEN
 * som ble avvist av denne e-posten alene. Reelt hull frem til nå (se
 * NATTLOGG.md) — `rejectRequest()` hadde tittelen i scope hele tiden
 * (`findSubmitted()`), men sendte den aldri med.
 */
export function renderRequestRejectedEmail(
  locale: SupportedLocale,
  title: string,
  reason: string
): RenderedEmail {
  const t = createTranslator(locale);

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.request_rejected.subject"),
    heading: t("email.request_rejected.heading"),
    body: t("email.request_rejected.body", { title, reason }),
  });
}
