import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { getCurrentSession } from "@/lib/auth/session";
import { getOwnedRequestDetail } from "@/lib/requests/requests";
import { listResponsesForRequest } from "@/lib/journalist-inbox/journalist-inbox";
import { Badge } from "@/components/Badge";
import styles from "./page.module.css";

// GET /[locale]/journalist/requests/[id]/responses (SPEC-V1.md 13, 20) —
// journalistens svarinnboks for én forespørsel: tellere + listevisning
// (visningsnavn, første linje av presentasjonen, innsendingstidspunkt,
// merking, om e-postadressen er delt). Ingen filtrering/sortering/søk i
// v1 (13, ordrett: "volumet forsvarer det ikke").
export default async function ResponseInboxPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const session = await getCurrentSession();
  if (!session || session.role !== "journalist") {
    redirect(`/${locale}/logg-inn`);
  }

  const request = await getOwnedRequestDetail(id, session.userId);
  if (!request) notFound();

  const result = await listResponsesForRequest(id, session.userId);
  if (!result.ok) notFound();
  const { summary, items } = result.data;

  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>
        {t("journalist.inbox.title", { title: request.title ?? "" })}
      </h1>
      <div className={styles.summary}>
        <span>{t("journalist.inbox.total_label", { count: summary.totalResponses })}</span>
        <span>{t("journalist.inbox.unread_label", { count: summary.unreadResponses })}</span>
        <span>{t("journalist.inbox.shortlisted_label", { count: summary.shortlistedResponses })}</span>
        <span>{t("journalist.inbox.contact_requests_label", { count: summary.contactRequestCount })}</span>
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>{t("journalist.inbox.empty")}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => {
            const preview = (item.shortBio || item.relevanceStatement).split("\n")[0];
            return (
              <li key={item.id} className={styles.item}>
                <div className={styles.itemMain}>
                  <span className={styles.itemName}>
                    {item.displayNameSnapshot || t("journalist.inbox.untitled_respondent")}
                  </span>
                  <span className={styles.itemPreview}>{preview}</span>
                  <span className={styles.itemMeta}>
                    {t("journalist.inbox.submitted_at_label", {
                      date: dateFormatter.format(item.submittedAt),
                    })}
                    {" · "}
                    {t(`journalist.response_detail.marking_${item.journalistMarking}`)}
                    {!item.viewedAt ? (
                      <>
                        {" · "}
                        <Badge tone="warning">{t("journalist.inbox.unread_badge")}</Badge>
                      </>
                    ) : null}
                    {item.hasSharedEmail ? (
                      <>
                        {" · "}
                        <Badge tone="success">{t("journalist.inbox.email_shared_badge")}</Badge>
                      </>
                    ) : null}
                  </span>
                </div>
                <Link href={`/${locale}/journalist/responses/${item.id}`} className={styles.viewLink}>
                  {t("journalist.inbox.view_link")}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
