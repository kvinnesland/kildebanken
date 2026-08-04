import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { SITE_ORIGIN } from "../digest";
import { renderSimpleCtaEmail, type RenderedEmail } from "./simple-cta-email";

/**
 * "Vesentlig endring i vilkår eller personvernerklæring" (SPEC-V1.md 17.2,
 * 15) — sendt til MOTTAKERE fra `publishLegalDocument()`
 * (src/lib/admin/legal-documents.ts), kun ved `isMaterialChange` for
 * `terms`/`privacy`. `locale` her ER dokumentets `docLocale` — mottakerne
 * som varsles er nettopp de med `users.locale === input.locale` ved
 * publisering, se kalleren. Lenker til dokumentets offentlige side
 * (`/[locale]/legal/[country]/[docLocale]/[type]`), samme rute som
 * samtykketeksten i registreringsskjemaet bruker (7.1).
 */
export function renderLegalTermsMaterialChangeEmail(
  locale: SupportedLocale,
  documentType: "terms" | "privacy",
  countryCode: string,
  countryDefaultLocale?: SupportedLocale
): RenderedEmail {
  const t = createTranslator(locale, countryDefaultLocale);
  const url = `${SITE_ORIGIN}/${locale}/legal/${countryCode.toLowerCase()}/${locale}/${documentType}`;
  const documentLabel = t(`email.legal_terms_material_change.document_type.${documentType}`);

  return renderSimpleCtaEmail({
    locale,
    subject: t("email.legal_terms_material_change.subject", { document: documentLabel }),
    heading: t("email.legal_terms_material_change.heading", { document: documentLabel }),
    body: t("email.legal_terms_material_change.body", { document: documentLabel }),
    ctaLabel: t("email.legal_terms_material_change.cta"),
    ctaUrl: url,
  });
}
