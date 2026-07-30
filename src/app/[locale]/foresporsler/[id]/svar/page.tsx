import Link from "next/link";
import { notFound } from "next/navigation";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { getCurrentSession } from "@/lib/auth/session";
import { getPublicRequest } from "@/lib/requests/requests";
import { buttonClassName } from "@/components/buttonClassName";
import { ResponseForm } from "./ResponseForm";
import styles from "./page.module.css";

// GET /[locale]/foresporsler/[id]/svar — SPEC-V1.md 12: svarskjemaet.
// "Innsending av svar krever verifisert konto" (11) — INGEN redirect til en
// annen side ved manglende innlogging (i motsetning til f.eks. en
// tradisjonell "login wall"): siden viser en tydelig forklaring OG en lenke
// til /logg-inn her, siden dette er den FØRSTE beskyttede siden i hele
// appen og ingen etablert "?to="-tilbake-mekanisme finnes ennå (se
// NATTLOGG.md, forrige del av økten).
export default async function RespondPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const session = await getCurrentSession();
  const request = await getPublicRequest(id);
  if (!request) notFound();

  if (!session || session.role !== "recipient") {
    return (
      <main className={styles.main}>
        <p className={styles.notice}>{t("response.form.not_logged_in")}</p>
        <Link href={`/${locale}/logg-inn`} className={buttonClassName("primary")}>
          {t("response.form.log_in_link")}
        </Link>
      </main>
    );
  }

  if (request.status !== "published") {
    return (
      <main className={styles.main}>
        <p className={styles.notice}>{t("response.form.not_open")}</p>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <p className={styles.loggedInAs}>{t("response.form.logged_in_as", { email: session.email })}</p>
      <ResponseForm
        locale={locale}
        requestId={request.id}
        journalistName={request.journalistFullName}
        organizationName={request.organizationName}
        sessionEmail={session.email}
      />
    </main>
  );
}
