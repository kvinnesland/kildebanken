import { notFound } from "next/navigation";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { getCurrentLegalDocument } from "@/lib/legal/documents";
import { legalDocumentType } from "@/db/schema";
import styles from "./page.module.css";

type LegalDocumentType = (typeof legalDocumentType.enumValues)[number];

function isLegalDocumentType(value: string): value is LegalDocumentType {
  return (legalDocumentType.enumValues as readonly string[]).includes(value);
}

// Offentlig visning av gjeldende vilkår/personvernerklæring (SPEC-V1.md
// 19.2), lenket fra samtykketeksten i registreringsskjemaet (7.1). `country`
// og `docLocale` er dokumentets EGEN (land, språk)-nøkkel — uavhengig av
// `[locale]`, som her kun styrer sidens egen chrome/feilmeldinger, jf. 3.1
// (locale og land er uavhengige akser).
export default async function LegalDocumentPage({
  params,
}: {
  params: Promise<{ locale: string; country: string; docLocale: string; type: string }>;
}) {
  const { locale: rawLocale, country, docLocale, type } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);

  if (!isLegalDocumentType(type)) notFound();

  const document = await getCurrentLegalDocument(country.toUpperCase(), docLocale, type);
  if (!document) notFound();

  const TITLE_KEYS: Record<LegalDocumentType, string> = {
    terms: "common.footer.terms_link",
    privacy: "common.footer.privacy_link",
    journalist_terms: "legal.journalist_terms_title",
  };

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t(TITLE_KEYS[type])}</h1>
      <p className={styles.meta}>{document.version}</p>
      <div className={styles.body}>{document.body}</div>
    </main>
  );
}
