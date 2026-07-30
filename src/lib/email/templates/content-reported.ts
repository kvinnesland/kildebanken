import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { SITE_ORIGIN } from "../digest";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Innhold rapportert (forespørsel eller svar)" (SPEC-V1.md 12.5, 15) —
 * sendt til moderatorene for landet fra `submitReport()`
 * (src/lib/reports/reports.ts). `reason`/`comment` er rapportørens
 * fritekst og oversettes ikke. Ingen egen rapport-datamodell i v1 (25,
 * punkt 10) — moderator vurderer og handler manuelt via
 * modereringskøen, som er samme lenkemål som `new_request_for_moderation`
 * bruker.
 */
export function renderContentReportedEmail(
  locale: SupportedLocale,
  entityType: "request" | "response",
  reason: string,
  comment: string
): RenderedEmail {
  const t = createTranslator(locale);
  const url = `${SITE_ORIGIN}/${locale}/admin/requests`;
  const entityLabel = t(`email.content_reported.entity_type.${entityType}`);

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.content_reported.subject"),
    heading: t("email.content_reported.heading"),
    body: comment
      ? t("email.content_reported.body_with_comment", { entity: entityLabel, reason, comment })
      : t("email.content_reported.body", { entity: entityLabel, reason }),
    ctaLabel: t("email.content_reported.cta"),
    ctaUrl: url,
  });
}
