import { redirect } from "next/navigation";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { getCurrentSession } from "@/lib/auth/session";
import { listJournalists } from "@/lib/moderation/journalists";
import { EmptyState } from "@/components/EmptyState";
import { JournalistQueueItem } from "./JournalistQueueItem";
import { JournalistSearchForm } from "./JournalistSearchForm";
import { JournalistSearchRow } from "./JournalistSearchRow";
import styles from "./page.module.css";

// GET /[locale]/admin/journalists (SPEC-V1.md 8, 16.2, 20). To deler: (1)
// den opprinnelige, uendrede køen over ubehandlede søknader (godkjenn/
// avvis) og (2) et søk på tvers av ALLE journalister uansett status (natt
// til 2026-08-01, se NATTLOGG.md — 16.2 lister "søk, ... suspender, opphev
// suspensjon, se tidligere forespørsler" for "Journalister", ingen av
// disse fantes i UI-en før nå). Søket skjer via URL-en (`?email=...`),
// samme mønster som admin/recipients/page.tsx.
export default async function AdminJournalistsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);
  const { email: emailQuery } = await searchParams;

  const session = await getCurrentSession();
  if (!session || (session.role !== "moderator" && session.role !== "admin")) {
    redirect(`/${locale}/logg-inn`);
  }

  const pending = await listJournalists(session, "pending_review");
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const hasQuery = Boolean(emailQuery && emailQuery.trim());
  const searchResults = hasQuery ? await listJournalists(session, undefined, emailQuery) : [];

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

      <section className={styles.searchSection}>
        <h2 className={styles.sectionTitle}>{t("admin.journalists.search_section_title")}</h2>
        <JournalistSearchForm locale={locale} initialQuery={emailQuery ?? ""} />

        {hasQuery && searchResults.length === 0 ? (
          <EmptyState
            title={t("admin.journalists.search_empty_title")}
            description={t("admin.journalists.search_empty_description")}
          />
        ) : searchResults.length > 0 ? (
          <ul className={styles.list}>
            {searchResults.map((journalist) => (
              <JournalistSearchRow
                key={journalist.userId}
                locale={locale}
                journalist={{
                  userId: journalist.userId,
                  email: journalist.email,
                  status: journalist.status,
                  statusLabel: t(`admin.journalists.status.${journalist.status}`),
                  fullName: journalist.fullName,
                  jobTitle: journalist.jobTitle,
                  organizationName: journalist.organizationName,
                  organizationUrl: journalist.organizationUrl,
                  verificationStatusLabel: t(
                    `admin.journalists.verification_status.${journalist.verificationStatus}`
                  ),
                  pastRequestsLabel: t("admin.journalists.past_requests_label", {
                    count: journalist.pastRequestCount,
                  }),
                }}
              />
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
