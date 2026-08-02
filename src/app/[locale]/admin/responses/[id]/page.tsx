import { notFound, redirect } from "next/navigation";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { getCurrentSession } from "@/lib/auth/session";
import {
  ADMIN_RESPONSE_ACCESS_REASONS,
  getResponseForAdmin,
  type AdminResponseAccessReason,
} from "@/lib/admin/responses";
import { ReasonPicker } from "./ReasonPicker";
import { HideResponseAction } from "./HideResponseAction";
import styles from "./page.module.css";

function isValidReason(value: string | undefined): value is AdminResponseAccessReason {
  return value !== undefined && (ADMIN_RESPONSE_ACCESS_REASONS as readonly string[]).includes(value);
}

// GET /[locale]/admin/responses/[id] (SPEC-V1.md 16.2, 20, FR-051) — den
// eneste veien inn i innholdet på et enkeltsvar fra administrasjons-
// grensesnittet. Reelt hull frem til nå (se NATTLOGG.md): API-ruten og
// selve tilgangslogikken (`getResponseForAdmin()`, med begrunnelseskrav og
// revisjonslogging) fantes allerede, men INGEN side noensinne lot en
// administrator faktisk bruke den — "content_reported"-e-postens lenke
// pekte derfor alltid til den generiske modereringskøen, som ikke lister
// svar (16.2: "Det finnes ingen visning som lister svar på tvers av
// forespørsler").
export default async function AdminResponseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ reason?: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);
  const { reason: reasonParam } = await searchParams;

  const session = await getCurrentSession();
  if (!session || session.role !== "admin") {
    redirect(`/${locale}/logg-inn`);
  }

  if (!isValidReason(reasonParam)) {
    return (
      <main className={styles.main}>
        <h1 className={styles.title}>{t("admin.response_detail.title")}</h1>
        <p className={styles.text}>{t("admin.response_detail.reason_prompt")}</p>
        <ReasonPicker locale={locale} responseId={id} />
      </main>
    );
  }

  const result = await getResponseForAdmin(id, reasonParam);
  if (!result.ok) notFound();
  const response = result.response;

  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("admin.response_detail.title")}</h1>

      <p className={styles.meta}>
        {t("admin.response_detail.respondent_label")}: {response.displayNameSnapshot || t("journalist.inbox.untitled_respondent")}
      </p>
      <p className={styles.meta}>
        {t("journalist.response_detail.submitted_at_label", { date: dateFormatter.format(response.submittedAt) })}
      </p>
      <p className={styles.meta}>
        {t("admin.response_detail.status_label")}: {t(`admin.response_detail.status.${response.lifecycleStatus}`)}
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

      <p className={styles.meta}>
        {response.contactSharing === "email"
          ? t("journalist.response_detail.contact_sharing_shared")
          : t("journalist.response_detail.contact_sharing_not_shared")}
      </p>

      {response.lifecycleStatus === "submitted" ? (
        <HideResponseAction locale={locale} responseId={response.id} />
      ) : response.lifecycleStatus === "hidden_by_moderator" ? (
        <p className={styles.meta}>{t("admin.response_detail.already_hidden_notice")}</p>
      ) : null}
    </main>
  );
}
