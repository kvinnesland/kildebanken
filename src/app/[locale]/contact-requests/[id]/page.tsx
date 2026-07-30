import { notFound, redirect } from "next/navigation";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { getCurrentSession } from "@/lib/auth/session";
import { getContactRequestDetail } from "@/lib/contact-requests/contact-requests";
import { Badge } from "@/components/Badge";
import { contactRequestStatusTone } from "@/lib/contact-requests/status-badge";
import { ContactRequestActions } from "./ContactRequestActions";
import styles from "./page.module.css";

// GET /[locale]/contact-requests/[id] (SPEC-V1.md 14.1-14.3, 20). Nåbar for
// BEGGE partene (journalisten som sendte den, og respondenten den gjelder)
// — getContactRequestDetail() håndhever selv hvem som får se hva (bl.a.
// skjuler shared_email for journalisten før godkjenning). Respondenten ser
// godkjenn/avslå-knapper når status er `pending`; alle andre tilstander
// (inkl. journalistens visning) er skrivebeskyttet.
export default async function ContactRequestPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const session = await getCurrentSession();
  if (!session) {
    redirect(`/${locale}/logg-inn`);
  }

  const detail = await getContactRequestDetail(id, session.userId);
  if (!detail) notFound();

  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const isRespondent = detail.respondentId === session.userId;

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("contact_request.title")}</h1>
        <Badge tone={contactRequestStatusTone(detail.status)}>
          {t(`contact_request.status.${detail.status}`)}
        </Badge>
      </div>

      <section>
        <h2 className={styles.sectionTitle}>{t("contact_request.message_label")}</h2>
        <p className={styles.text}>{detail.message}</p>
      </section>

      <p className={styles.meta}>
        {t("contact_request.method_label")}: {detail.requestedContactMethod}
      </p>
      <p className={styles.meta}>
        {t("contact_request.expires_label", { date: dateFormatter.format(detail.expiresAt) })}
      </p>

      {detail.sharedEmail ? (
        <p className={styles.meta}>
          {t("contact_request.shared_email_label")}: {detail.sharedEmail}
        </p>
      ) : null}

      {isRespondent && detail.status === "pending" ? (
        <ContactRequestActions locale={locale} contactRequestId={detail.id} />
      ) : null}
    </main>
  );
}
