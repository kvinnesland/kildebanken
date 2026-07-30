import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { getPublicRequest } from "@/lib/requests/requests";
import { isPublicRequestStatus, publicRequestStatusTone } from "@/lib/requests/status-badge";
import { SITE_ORIGIN } from "@/lib/email/digest";
import { Badge } from "@/components/Badge";
import { buttonClassName } from "@/components/buttonClassName";
import { ReportForm } from "@/components/ReportForm";
import styles from "./page.module.css";

interface RouteParams {
  locale: string;
  id: string;
  slug: string;
}

async function loadRequest(id: string) {
  const request = await getPublicRequest(id);
  if (!request) notFound();
  return request;
}

// SPEC-V1.md 11: "kanonisk URL per locale-variant, hreflang-alternater og
// delingsbilde" (delingsbilde/OG-bilde er bevisst IKKE bygget ennå — se
// NATTLOGG.md, ingen bilde-genereringsinfrastruktur finnes i prosjektet). Og
// "noindex på alt utenfor de offentlige forespørselssidene" — layout.tsx sin
// standard er noindex, denne siden overstyrer eksplisitt til index.
export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { locale: rawLocale, id } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const request = await loadRequest(id);
  const path = `/${locale}/foresporsler/${request.id}/${request.slug}`;

  const languageAlternates: Record<string, string> = {};
  for (const availableLocale of request.countryAvailableLocales) {
    if (isSupportedLocale(availableLocale)) {
      languageAlternates[availableLocale] = `${SITE_ORIGIN}/${availableLocale}/foresporsler/${request.id}/${request.slug}`;
    }
  }

  return {
    title: request.title ?? undefined,
    description: request.summary ?? undefined,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${SITE_ORIGIN}${path}`,
      languages: languageAlternates,
    },
    openGraph: {
      type: "article",
      title: request.title ?? undefined,
      description: request.summary ?? undefined,
      url: `${SITE_ORIGIN}${path}`,
      locale,
    },
  };
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { locale: rawLocale, id, slug } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);
  const request = await loadRequest(id);

  // Kanonisk URL per locale-variant (11) — en gjettet/utdatert slug skal
  // aldri gi to indekserbare URL-er for samme forespørsel.
  if (request.slug && slug !== request.slug) {
    redirect(`/${locale}/foresporsler/${request.id}/${request.slug}`);
  }

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: request.countryTimezone,
  });

  const deadlineText = request.responseDeadline
    ? `${dateFormatter.format(request.responseDeadline)} (${request.countryTimezone})`
    : null;
  const publishedText = request.publishedAt ? dateFormatter.format(request.publishedAt) : "";

  const showForeignLanguageNotice = request.contentLanguage !== locale;
  const canRespond = request.status === "published";

  // getPublicRequest() sin WHERE-klausul garanterer dette, men Drizzle sin
  // kolonnetype er hele status-enumet — se status-badge.ts sin kommentar.
  if (!isPublicRequestStatus(request.status)) notFound();

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <Badge tone={publicRequestStatusTone(request.status)}>
          {t(`request.status.${request.status}`)}
        </Badge>
        <h1 className={styles.title}>{request.title}</h1>
        <p className={styles.byline}>
          {t("request.published_by", {
            publishedAt: publishedText,
            journalistName: request.journalistFullName,
            organizationName: request.organizationName,
          })}
        </p>
      </div>

      {showForeignLanguageNotice ? (
        <p className={styles.notice}>{t("request.foreign_language_notice")}</p>
      ) : null}

      {request.status === "closed" ? <p className={styles.notice}>{t("request.closed_notice")}</p> : null}
      {request.status === "expired" ? <p className={styles.notice}>{t("request.expired_notice")}</p> : null}

      <p className={styles.summary}>{request.summary}</p>

      <div className={styles.body}>{request.description}</div>

      {request.targetPersonDescription ? (
        <section>
          <h2 className={styles.sectionTitle}>{t("request.target_person_label")}</h2>
          <p className={styles.body}>{request.targetPersonDescription}</p>
        </section>
      ) : null}

      <ul className={styles.infoList}>
        <li>{t("request.info.anonymous_participation", { allowed: request.allowsAnonymousParticipation ? "yes" : "no" })}</li>
        <li>{t("request.info.recording", { allowed: request.mayBeRecorded ? "yes" : "no" })}</li>
        <li>{t("request.info.photo_video", { allowed: request.mayInvolvePhotoVideo ? "yes" : "no" })}</li>
      </ul>

      {deadlineText ? (
        <p className={styles.deadline}>{t("request.deadline_label", { deadline: deadlineText })}</p>
      ) : null}

      <div className={styles.actions}>
        {canRespond ? (
          <Link href={`/${locale}/foresporsler/${request.id}/svar`} className={buttonClassName("primary")}>
            {t("request.respond_button")}
          </Link>
        ) : null}
        <ReportForm locale={locale} entityType="request" entityId={request.id} />
      </div>
    </main>
  );
}
