import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { SITE_ORIGIN } from "../digest";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Endringer kreves, med kommentar" (SPEC-V1.md 15) — sendt til
 * journalisten fra `requestChanges()` (src/lib/moderation/requests.ts).
 * `comment` er moderators fritekst og oversettes ikke (samme prinsipp som
 * `journalist_rejected`s `reason`). Lenker til journalistens egen
 * redigeringsside — forespørselen ER redigerbar i `changes_requested`
 * (se EDITABLE_STATUSES i journalist/requests/[id]/page.tsx).
 */
export function renderChangesRequestedEmail(
  locale: SupportedLocale,
  requestId: string,
  comment: string,
  countryDefaultLocale?: SupportedLocale
): RenderedEmail {
  const t = createTranslator(locale, countryDefaultLocale);
  const url = `${SITE_ORIGIN}/${locale}/journalist/requests/${requestId}`;

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.changes_requested.subject"),
    heading: t("email.changes_requested.heading"),
    body: t("email.changes_requested.body", { comment }),
    ctaLabel: t("email.changes_requested.cta"),
    ctaUrl: url,
  });
}
