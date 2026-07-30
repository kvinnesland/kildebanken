import { notFound, redirect } from "next/navigation";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { getCurrentSession } from "@/lib/auth/session";
import { getCountryFormOptions, getOwnedRequestDetail } from "@/lib/requests/requests";
import { utcToZonedWallTime } from "@/lib/datetime/timezone";
import { Badge } from "@/components/Badge";
import {
  isJournalistRequestStatus,
  journalistRequestStatusTone,
} from "@/lib/requests/status-badge";
import { RequestEditForm } from "./RequestEditForm";
import styles from "./page.module.css";

const EDITABLE_STATUSES = new Set(["draft", "changes_requested"]);

// GET /[locale]/journalist/requests/[id] — redigeringssiden for et utkast
// eller en forespørsel moderator har bedt om endringer på (SPEC-V1.md 9,
// 20). Andre statuser (submitted/published/closed/expired/rejected) vises
// som en skrivebeskyttet oppsummering — PATCH /requests/:id nekter uansett
// å kjøre utenfor draft/changes_requested (updateDraft()), så dette er en
// speiling av en regel som allerede håndheves server-side, ikke en ny en.
export default async function EditRequestPage({
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

  const status = isJournalistRequestStatus(request.status) ? request.status : "draft";
  const editable = EDITABLE_STATUSES.has(status);

  const countryOptions = await getCountryFormOptions(request.countryCode);
  const availableLocales = countryOptions?.availableLocales ?? [request.contentLanguage];
  const timezone = countryOptions?.timezone ?? "UTC";

  if (!editable) {
    return (
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>{request.title ?? t("journalist.requests.untitled")}</h1>
          <Badge tone={journalistRequestStatusTone(status)}>{t(`request.status.${status}`)}</Badge>
        </div>
        <p className={styles.notice}>{t("journalist.request_form.not_editable_notice")}</p>
        {status === "rejected" && request.moderatorComment ? (
          <p className={styles.comment}>
            <strong>{t("journalist.request_form.rejection_reason_label")}:</strong>{" "}
            {request.moderatorComment}
          </p>
        ) : null}
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <h1 className={styles.title}>{request.title ?? t("journalist.requests.untitled")}</h1>
        <Badge tone={journalistRequestStatusTone(status)}>{t(`request.status.${status}`)}</Badge>
      </div>
      {status === "changes_requested" && request.moderatorComment ? (
        <p className={styles.comment}>
          <strong>{t("journalist.request_form.changes_requested_comment_label")}:</strong>{" "}
          {request.moderatorComment}
        </p>
      ) : null}
      <RequestEditForm
        locale={locale}
        requestId={request.id}
        availableLocales={availableLocales}
        timezone={timezone}
        initial={{
          title: request.title ?? "",
          summary: request.summary ?? "",
          description: request.description ?? "",
          targetPersonDescription: request.targetPersonDescription ?? "",
          topic: request.topic,
          geographicNote: request.geographicNote ?? "",
          internalReference: request.internalReference ?? "",
          contentLanguage: request.contentLanguage,
          responseDeadlineLocal: request.responseDeadline
            ? utcToZonedWallTime(request.responseDeadline, timezone)
            : "",
          allowsAnonymousParticipation: request.allowsAnonymousParticipation,
          mayBeRecorded: request.mayBeRecorded,
          mayInvolvePhotoVideo: request.mayInvolvePhotoVideo,
        }}
      />
    </main>
  );
}
