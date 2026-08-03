import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { getCurrentSession } from "@/lib/auth/session";
import { getResponseDetailForJournalist } from "@/lib/journalist-inbox/journalist-inbox";
import { ReportForm } from "@/components/ReportForm";
import { ResponseDetailPanel } from "./ResponseDetailPanel";
import styles from "./page.module.css";

// GET /[locale]/journalist/responses/[id] (SPEC-V1.md 13, 20). Setter
// viewed_at ved FØRSTE åpning (inne i getResponseDetailForJournalist() —
// utløser ingen e-post til respondenten, 13, ordrett).
export default async function ResponseDetailPage({
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

  const result = await getResponseDetailForJournalist(id, session.userId);
  if (!result.ok) notFound();
  const response = result.data;

  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  // SPEC-V1.md 13: "tidslinje for handlinger" — reelt hull frem til nå (se
  // NATTLOGG.md), aldri bygget til tross for at fire av fem elementer i
  // samme setning allerede fantes. Sortert kronologisk siden hendelsene ikke
  // nødvendigvis er tidsstempel-sortert i utgangspunktet (viewedAt kan i
  // teorien mangle om raden ble hentet uten å utløse den vanlige
  // set-ved-første-åpning-logikken).
  const timelineEvents: { labelKey: string; date: Date }[] = [
    { labelKey: "journalist.response_detail.timeline_submitted", date: response.submittedAt },
  ];
  if (response.viewedAt) {
    timelineEvents.push({ labelKey: "journalist.response_detail.timeline_viewed", date: response.viewedAt });
  }
  if (response.contactRequest) {
    const cr = response.contactRequest;
    timelineEvents.push({ labelKey: "journalist.response_detail.timeline_contact_requested", date: cr.createdAt });
    if (cr.status === "approved" && cr.respondedAt) {
      timelineEvents.push({ labelKey: "journalist.response_detail.timeline_contact_approved", date: cr.respondedAt });
    } else if (cr.status === "declined" && cr.respondedAt) {
      timelineEvents.push({ labelKey: "journalist.response_detail.timeline_contact_declined", date: cr.respondedAt });
    } else if (cr.status === "expired") {
      timelineEvents.push({ labelKey: "journalist.response_detail.timeline_contact_expired", date: cr.expiresAt });
    } else if (cr.status === "cancelled") {
      // `updatedAt` er nå pålitelig her — se ContactRequest sin egen
      // kommentar i journalist-inbox.ts (Økt 67, NATTLOGG.md).
      timelineEvents.push({ labelKey: "journalist.response_detail.timeline_contact_cancelled", date: cr.updatedAt });
    }
  }
  timelineEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <main className={styles.main}>
      <Link href={`/${locale}/journalist/requests/${response.requestId}/responses`} className={styles.backLink}>
        {t("journalist.response_detail.back_link")}
      </Link>

      <h1 className={styles.title}>
        {response.displayNameSnapshot || t("journalist.inbox.untitled_respondent")}
      </h1>
      <p className={styles.meta}>
        {t("journalist.response_detail.submitted_at_label", {
          date: dateFormatter.format(response.submittedAt),
        })}
      </p>

      {response.shortBio ? (
        <section>
          <h2 className={styles.sectionTitle}>{t("journalist.response_detail.short_bio_label")}</h2>
          <p className={styles.text}>{response.shortBio}</p>
        </section>
      ) : null}

      <section>
        <h2 className={styles.sectionTitle}>{t("response.form.relevance_label")}</h2>
        <p className={styles.text}>{response.relevanceStatement}</p>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>{t("journalist.response_detail.answer_label")}</h2>
        <p className={styles.text}>{response.answerText}</p>
      </section>

      <p className={styles.contactSharing}>
        {response.contactSharing === "email"
          ? t("journalist.response_detail.contact_sharing_shared")
          : t("journalist.response_detail.contact_sharing_not_shared")}
      </p>
      {response.sharedEmail ? (
        <p className={styles.contactSharing}>
          {t("contact_request.shared_email_label")}: {response.sharedEmail}
        </p>
      ) : null}

      <section>
        <h2 className={styles.sectionTitle}>{t("journalist.response_detail.timeline_title")}</h2>
        <ul className={styles.timelineList}>
          {timelineEvents.map((event, index) => (
            <li key={`${event.labelKey}-${index}`} className={styles.timelineItem}>
              <span>{t(event.labelKey)}</span>
              <span className={styles.timelineDate}>{dateFormatter.format(event.date)}</span>
            </li>
          ))}
        </ul>
      </section>

      <ResponseDetailPanel
        locale={locale}
        responseId={response.id}
        initialMarking={response.journalistMarking}
        initialNote={response.journalistNote ?? ""}
        showContactRequestForm={response.contactSharing !== "email"}
      />

      <ReportForm locale={locale} entityType="response" entityId={response.id} />
    </main>
  );
}
