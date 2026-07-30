import { redirect } from "next/navigation";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { countries } from "@/db/schema";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { getCurrentSession } from "@/lib/auth/session";
import { listAllCountries } from "@/lib/admin/countries";
import { getDashboardCountries, getDashboardStatsForCountry } from "@/lib/admin/dashboard";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { CountrySelector } from "./CountrySelector";
import styles from "./page.module.css";

// GET /[locale]/admin (SPEC-V1.md 16.1, 20) — dashbordet. "Filtrert på
// moderatorens tildelte land, med landvelger for administrator": en
// moderator ser automatisk (potensielt flere) tildelte land uten noe valg
// å ta, mens en administrator velger ETT land om gangen via `?country=`
// (se CountrySelector.tsx). Se src/lib/admin/dashboard.ts for selve
// tallene og begrunnelsen for hvorfor dette ikke er én global aggregering.
export default async function AdminDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ country?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);
  const { country: countryParam } = await searchParams;

  const session = await getCurrentSession();
  if (!session || (session.role !== "moderator" && session.role !== "admin")) {
    redirect(`/${locale}/logg-inn`);
  }

  let allCountryOptions: { code: string; nameKey: string }[] = [];
  let selectedCountryCode = countryParam;

  if (session.role === "admin") {
    const result = await listAllCountries();
    if (result.ok) {
      allCountryOptions = [...result.countries].sort((a, b) => a.code.localeCompare(b.code));
      if (!selectedCountryCode && allCountryOptions.length > 0) {
        selectedCountryCode = allCountryOptions[0]!.code;
      }
    }
  }

  const countryCodes = await getDashboardCountries(session, selectedCountryCode);

  const countryRows =
    countryCodes.length > 0
      ? await db
          .select({ code: countries.code, nameKey: countries.nameKey })
          .from(countries)
          .where(inArray(countries.code, countryCodes))
      : [];
  const nameKeyByCountry = new Map(countryRows.map((c) => [c.code, c.nameKey]));

  const statsByCountry = await Promise.all(
    countryCodes.map((code) => getDashboardStatsForCountry(code))
  );

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("admin.dashboard.title")}</h1>

      {session.role === "admin" ? (
        <CountrySelector
          locale={locale}
          countries={allCountryOptions.map((c) => ({ id: c.code, label: t(c.nameKey) }))}
          selectedCountryCode={selectedCountryCode}
        />
      ) : null}

      {statsByCountry.length === 0 ? (
        <EmptyState
          title={t("admin.dashboard.empty_title")}
          description={t("admin.dashboard.empty_description")}
        />
      ) : (
        <div className={styles.countryList}>
          {statsByCountry.map((stats) => {
            const nameKey = nameKeyByCountry.get(stats.countryCode);
            return (
              <Card key={stats.countryCode} title={nameKey ? t(nameKey) : stats.countryCode}>
                <dl className={styles.statGrid}>
                  <div className={styles.stat}>
                    <dt className={styles.statLabel}>
                      {t("admin.dashboard.pending_journalist_applications_label")}
                    </dt>
                    <dd className={styles.statValue}>{stats.pendingJournalistApplications}</dd>
                  </div>
                  <div className={styles.stat}>
                    <dt className={styles.statLabel}>{t("admin.dashboard.moderation_queue_label")}</dt>
                    <dd className={styles.statValue}>{stats.moderationQueueCount}</dd>
                  </div>
                  <div className={styles.stat}>
                    <dt className={styles.statLabel}>{t("admin.dashboard.active_requests_label")}</dt>
                    <dd className={styles.statValue}>{stats.activeRequestsCount}</dd>
                  </div>
                  <div className={styles.stat}>
                    <dt className={styles.statLabel}>{t("admin.dashboard.expiring_soon_label")}</dt>
                    <dd className={styles.statValue}>{stats.expiringSoonCount}</dd>
                  </div>
                  <div className={styles.stat}>
                    <dt className={styles.statLabel}>{t("admin.dashboard.new_recipients_label")}</dt>
                    <dd className={styles.statValue}>{stats.newRecipientsLast7Days}</dd>
                  </div>
                  <div className={styles.stat}>
                    <dt className={styles.statLabel}>{t("admin.dashboard.unsubscribes_label")}</dt>
                    <dd className={styles.statValue}>{stats.unsubscribesLast7Days}</dd>
                  </div>
                </dl>

                <p className={styles.digestStatus}>
                  {stats.lastDigest
                    ? t("admin.dashboard.last_digest_label", {
                        date: stats.lastDigest.scheduledFor,
                        status: t(`admin.dashboard.digest_status.${stats.lastDigest.status}`),
                        recipientCount: stats.lastDigest.recipientCount,
                        failedCount: stats.lastDigest.failedDeliveryCount,
                      })
                    : t("admin.dashboard.last_digest_none")}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
