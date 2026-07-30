import { redirect } from "next/navigation";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { getCurrentSession } from "@/lib/auth/session";
import { listJournalists } from "@/lib/moderation/journalists";
import { EmptyState } from "@/components/EmptyState";
import { JournalistQueueItem } from "./JournalistQueueItem";
import styles from "./page.module.css";

// GET /[locale]/admin/journalists (SPEC-V1.md 8, 16, 20) — moderatorens/
// administratorens kø over ubehandlede journalistsøknader. Bare listing +
// godkjenn/avvis her, IKKE hele 16.1-dashbordet (statistikk, andre køer
// osv.) — se NATTLOGG.md for hvorfor dette bevisst er en tynn skive.
export default async function AdminJournalistsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const session = await getCurrentSession();
  if (!session || (session.role !== "moderator" && session.role !== "admin")) {
    redirect(`/${locale}/logg-inn`);
  }

  const pending = await listJournalists(session, "pending_review");
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("admin.journalists.title")}</h1>

      {pending.length === 0 ? (
        <EmptyState
          title={t("admin.journalists.empty_title")}
          description={t("admin.journalists.empty_description")}
        />
      ) : (
        <ul className={styles.list}>
          {pending.map((journalist) => (
            <JournalistQueueItem
              key={journalist.userId}
              locale={locale}
              journalist={{
                userId: journalist.userId,
                fullName: journalist.fullName,
                jobTitle: journalist.jobTitle,
                organizationName: journalist.organizationName,
                organizationUrl: journalist.organizationUrl,
                appliedLabel: t("admin.journalists.applied_label", {
                  createdAt: dateFormatter.format(journalist.createdAt),
                }),
              }}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
