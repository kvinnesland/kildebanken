import { redirect } from "next/navigation";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { getCurrentSession } from "@/lib/auth/session";
import { getMyProfile } from "@/lib/me/profile";
import { ChangeCountryForm } from "./ChangeCountryForm";
import styles from "./page.module.css";

// GET /[locale]/me/bytt-land (SPEC-V1.md 7.3, 20) — "En mottaker kan bytte
// land i innstillingene." Kun mottakere (7.3, siste avsnitt: en journalist
// kan ikke bytte land selv, det krever ny moderatorvurdering) — håndhevet
// her OG i POST /me/change-country (samme fordeling som resten av
// kodebasen: ruten/siden avgjør rolle, biblioteket avgjør forretningsregler).
export default async function ChangeCountryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const session = await getCurrentSession();
  if (!session || session.role !== "recipient") {
    redirect(`/${locale}/me`);
  }

  const profile = await getMyProfile(session.userId);
  if (!profile) {
    redirect(`/${locale}/me`);
  }

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("me.change_country.title")}</h1>
      <p className={styles.notice}>{t("me.change_country.responses_notice")}</p>
      <ChangeCountryForm
        locale={locale}
        currentCountryCode={profile.countryCode}
        currentLocale={profile.locale}
      />
    </main>
  );
}
