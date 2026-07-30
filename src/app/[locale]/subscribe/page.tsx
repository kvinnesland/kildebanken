import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { SubscribeForm } from "./SubscribeForm";
import styles from "./page.module.css";

// GET /[locale]/subscribe — registreringsskjemaet for mottakere (SPEC-V1.md
// 7.1). Tynn server-komponent: løser locale og rendrer overskrift, selve
// skjemaet er en klientkomponent (SubscribeForm) fordi det trenger å hente
// land live og holde skjematilstand.
export default async function SubscribePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("recipient.register.title")}</h1>
      <SubscribeForm locale={locale} />
    </main>
  );
}
