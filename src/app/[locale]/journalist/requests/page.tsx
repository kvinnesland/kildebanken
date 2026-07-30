import Link from "next/link";
import { redirect } from "next/navigation";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { getCurrentSession } from "@/lib/auth/session";
import { getCountryFormOptions, listMineRequests } from "@/lib/requests/requests";
import {
  isJournalistRequestStatus,
  journalistRequestStatusTone,
} from "@/lib/requests/status-badge";
import { Badge } from "@/components/Badge";
import { buttonClassName } from "@/components/buttonClassName";
import { NewRequestButton } from "./NewRequestButton";
import styles from "./page.module.css";

const EDITABLE_STATUSES = new Set(["draft", "changes_requested"]);

// GET /[locale]/journalist/requests (SPEC-V1.md 9, 13, 20) — journalistens
// egen forespørselsliste. Ingen offentlig visning her (i motsetning til
// /foresporsler/...): krever en aktiv journalist-økt, samme mønster som
// svarskjemaets innloggingssjekk.
export default async function MyRequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const session = await getCurrentSession();
  if (!session || session.role !== "journalist") {
    redirect(`/${locale}/logg-inn`);
  }

  const [mine, countryOptions] = await Promise.all([
    listMineRequests(session.userId),
    getCountryFormOptions(session.countryCode),
  ]);
  const timezone = countryOptions?.timezone ?? "UTC";

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("journalist.requests.title")}</h1>
        <NewRequestButton locale={locale} />
      </div>

      {mine.length === 0 ? (
        <p className={styles.empty}>{t("journalist.requests.empty")}</p>
      ) : (
        <ul className={styles.list}>
          {mine.map((request) => {
            const status = isJournalistRequestStatus(request.status) ? request.status : "draft";
            const editable = EDITABLE_STATUSES.has(status);
            return (
              <li key={request.id} className={styles.item}>
                <div className={styles.itemMain}>
                  <span className={styles.itemTitle}>
                    {request.title ?? t("journalist.requests.untitled")}
                  </span>
                  <span className={styles.itemMeta}>
                    <Badge tone={journalistRequestStatusTone(status)}>
                      {t(`request.status.${status}`)}
                    </Badge>
                    {request.responseDeadline
                      ? " · " +
                        t("journalist.requests.deadline_label", {
                          deadline: dateFormatter.format(request.responseDeadline),
                        })
                      : null}
                  </span>
                </div>
                <div className={styles.itemActions}>
                  {editable ? (
                    <Link
                      href={`/${locale}/journalist/requests/${request.id}`}
                      className={buttonClassName("secondary")}
                    >
                      {t("journalist.requests.edit_link")}
                    </Link>
                  ) : null}
                  {status === "published" || status === "closed" || status === "expired" ? (
                    request.slug ? (
                      <Link
                        href={`/${locale}/foresporsler/${request.id}/${request.slug}`}
                        className={buttonClassName("ghost")}
                      >
                        {t("journalist.requests.view_link")}
                      </Link>
                    ) : null
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
