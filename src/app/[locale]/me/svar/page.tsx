import { redirect } from "next/navigation";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { getCurrentSession } from "@/lib/auth/session";
import { listMineResponses } from "@/lib/responses/responses";
import { EmptyState } from "@/components/EmptyState";
import { MyResponsesList } from "./MyResponsesList";
import styles from "./page.module.css";

// GET /[locale]/me/svar (SPEC-V1.md 12.6, 20) — respondentens oversikt over
// egne innsendte svar. Kun mottakere (samme rollebegrensning som
// GET /responses/mine selv).
export default async function MyResponsesPage({
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

  const mine = await listMineResponses(session.userId);
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("me.my_responses.title")}</h1>

      {mine.length === 0 ? (
        <EmptyState
          title={t("me.my_responses.empty_title")}
          description={t("me.my_responses.empty_description")}
        />
      ) : (
        <MyResponsesList
          locale={locale}
          items={mine.map((item) => ({
            id: item.id,
            requestTitle: item.requestTitle,
            organizationName: item.organizationName,
            displayStatus: item.displayStatus,
            canWithdraw: item.canWithdraw,
            submittedAtLabel: t("me.my_responses.submitted_at_label", {
              date: dateFormatter.format(item.submittedAt),
            }),
          }))}
        />
      )}
    </main>
  );
}
