import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { LoginForm } from "./LoginForm";
import styles from "./page.module.css";

// GET /[locale]/logg-inn — SPEC-V1.md 6.1: "Kun e-post og engangslenke
// (magic link). Ingen passord." Samme mønster som subscribe-/
// journalists/apply-sidene: tynn server-komponent, selve skjemaet er en
// klientkomponent.
//
// `?feil=utlopt` settes av GET /api/auth/verify (route handler, se den
// filen) når et token er ugyldig/utløpt/allerede brukt — selve
// verifiseringen (og økt-opprettelsen) skjer der, ikke her, siden en
// Server Component-side ikke kan sette cookies (se kommentaren i
// route.ts). Denne siden viser bare den resulterende feilmeldingen.
export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ feil?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const { feil } = await searchParams;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("auth.request_link.title")}</h1>
      {feil === "utlopt" ? <p className={styles.notice}>{t("auth.verify.expired")}</p> : null}
      <LoginForm locale={locale} />
    </main>
  );
}
