import { Suspense } from "react";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { ConfirmDeletionClient } from "./ConfirmDeletionClient";
import styles from "./page.module.css";

// GET /[locale]/me/slett-konto?token=... — den faktiske klikkbare lenken i
// confirm_account_deletion-e-posten. `useSearchParams()` krever en
// <Suspense>-grense i App Router (ellers feiler produksjonsbygget), samme
// mønster Next selv dokumenterer for denne hooken.
export default async function ConfirmDeletionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("me.delete_account_title")}</h1>
      <Suspense fallback={<p className={styles.notice}>{t("me.confirm_deletion.pending")}</p>}>
        <ConfirmDeletionClient locale={locale} />
      </Suspense>
    </main>
  );
}
