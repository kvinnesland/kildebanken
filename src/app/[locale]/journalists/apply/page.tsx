import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { JournalistApplyForm } from "./JournalistApplyForm";
import styles from "./page.module.css";

// GET /[locale]/journalists/apply — søknadsskjemaet for journalister
// (SPEC-V1.md 7.2). Samme mønster som /[locale]/subscribe: tynn
// server-komponent, selve skjemaet er en klientkomponent som henter land
// live og holder skjematilstand.
export default async function JournalistApplyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("journalist.apply.title")}</h1>
      <p className={styles.disclaimer}>{t("journalist.apply.disclaimer")}</p>
      <JournalistApplyForm locale={locale} />
    </main>
  );
}
