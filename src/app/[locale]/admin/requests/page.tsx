import { redirect } from "next/navigation";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { countries } from "@/db/schema";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { getCurrentSession } from "@/lib/auth/session";
import { listActiveRequests, listModerationQueue } from "@/lib/moderation/requests";
import { EmptyState } from "@/components/EmptyState";
import { RequestQueueItem } from "./RequestQueueItem";
import { ActiveRequestItem } from "./ActiveRequestItem";
import styles from "./page.module.css";

// GET /[locale]/admin/requests (SPEC-V1.md 9.3, 16, 20) — moderatorens/
// administratorens kø over innsendte forespørsler. Samme "tynn skive"-
// begrunnelse som /admin/journalists — se NATTLOGG.md.
export default async function AdminRequestsPage({
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

  const [queue, activeRequests] = await Promise.all([
    listModerationQueue(session),
    listActiveRequests(session),
  ]);

  // Ett land i produksjon per 26.1, men slår opp riktig likevel — én enkel
  // spørring for alle distinkte land på tvers av BEGGE listene, ikke
  // hardkodet til det ene.
  const distinctCountryCodes = [
    ...new Set([...queue.map((r) => r.countryCode), ...activeRequests.map((r) => r.countryCode)]),
  ];
  const countryRows =
    distinctCountryCodes.length > 0
      ? await db
          .select({ code: countries.code, timezone: countries.timezone })
          .from(countries)
          .where(inArray(countries.code, distinctCountryCodes))
      : [];
  const timezoneByCountry = new Map(countryRows.map((c) => [c.code, c.timezone]));

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("admin.requests.title")}</h1>

      {queue.length === 0 ? (
        <EmptyState
          title={t("admin.requests.empty_title")}
          description={t("admin.requests.empty_description")}
        />
      ) : (
        <ul className={styles.list}>
          {queue.map((request) => {
            const timezone = timezoneByCountry.get(request.countryCode) ?? "UTC";
            const dateFormatter = new Intl.DateTimeFormat(locale, {
              timeZone: timezone,
              dateStyle: "medium",
              timeStyle: "short",
            });
            return (
              <RequestQueueItem
                key={request.id}
                locale={locale}
                request={{
                  id: request.id,
                  title: request.title ?? "",
                  summary: request.summary ?? "",
                  description: request.description ?? "",
                  targetPersonDescription: request.targetPersonDescription ?? "",
                  byLabel: t("admin.requests.by_label", {
                    journalistName: request.journalistFullName,
                    organizationName: request.organizationName,
                  }),
                  deadlineLabel: request.responseDeadline
                    ? t("admin.requests.deadline_label", {
                        deadline: dateFormatter.format(request.responseDeadline),
                      })
                    : "",
                }}
              />
            );
          })}
        </ul>
      )}

      <h2 className={styles.title}>{t("admin.requests.active_title")}</h2>

      {activeRequests.length === 0 ? (
        <EmptyState
          title={t("admin.requests.active_empty_title")}
          description={t("admin.requests.active_empty_description")}
        />
      ) : (
        <ul className={styles.list}>
          {activeRequests.map((request) => {
            const timezone = timezoneByCountry.get(request.countryCode) ?? "UTC";
            const dateFormatter = new Intl.DateTimeFormat(locale, {
              timeZone: timezone,
              dateStyle: "medium",
              timeStyle: "short",
            });
            return (
              <ActiveRequestItem
                key={request.id}
                locale={locale}
                request={{
                  id: request.id,
                  title: request.title ?? "",
                  summary: request.summary ?? "",
                  byLabel: t("admin.requests.by_label", {
                    journalistName: request.journalistFullName,
                    organizationName: request.organizationName,
                  }),
                  publishedAtLabel: request.publishedAt
                    ? t("admin.requests.published_at_label", {
                        date: dateFormatter.format(request.publishedAt),
                      })
                    : "",
                }}
              />
            );
          })}
        </ul>
      )}
    </main>
  );
}
