import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { SITE_ORIGIN } from "../digest";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Innhold rapportert (forespørsel eller svar)" (SPEC-V1.md 12.5, 15) —
 * sendt til moderatorene for landet fra `submitReport()`
 * (src/lib/reports/reports.ts). `reason`/`comment` er rapportørens
 * fritekst og oversettes ikke. Ingen egen rapport-datamodell i v1 (25,
 * punkt 10) — moderator vurderer og handler manuelt.
 *
 * `entityId` bestemmer lenkemålet: en rapportert FORESPØRSEL lenker til
 * modereringskøen (samme mål som `new_request_for_moderation` bruker,
 * som allerede lister alle innsendte forespørsler). En rapportert SVAR
 * lenker derimot til det spesifikke svaret via `/admin/responses/:id`
 * (16.2, FR-051) — reelt hull frem til nå (se NATTLOGG.md): `entityId`
 * ble tidligere aldri sendt med, og lenken pekte alltid til
 * modereringskøen selv for et rapportert svar, som ikke lister
 * enkeltsvar i det hele tatt (16.2: "Det finnes ingen visning som lister
 * svar på tvers av forespørsler") — moderatoren hadde ingen måte å finne
 * frem til det rapporterte svaret på annet enn å vite ID-en fra selve
 * e-postens tekst (som heller ikke var med).
 */
export function renderContentReportedEmail(
  locale: SupportedLocale,
  entityType: "request" | "response",
  entityId: string,
  reason: string,
  comment: string,
  countryDefaultLocale?: SupportedLocale
): RenderedEmail {
  const t = createTranslator(locale, countryDefaultLocale);
  const url =
    entityType === "response"
      ? `${SITE_ORIGIN}/${locale}/admin/responses/${entityId}`
      : `${SITE_ORIGIN}/${locale}/admin/requests`;
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
