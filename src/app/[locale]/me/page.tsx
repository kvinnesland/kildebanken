import Link from "next/link";
import { redirect } from "next/navigation";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { getCurrentSession } from "@/lib/auth/session";
import { getMyProfile } from "@/lib/me/profile";
import { getJournalistProfile } from "@/lib/journalists/journalist-profile";
import { buttonClassName } from "@/components/buttonClassName";
import { ProfileForm } from "./ProfileForm";
import { JournalistProfileForm } from "./JournalistProfileForm";
import { DeleteAccountSection } from "./DeleteAccountSection";
import styles from "./page.module.css";

// GET /[locale]/me (SPEC-V1.md 20) — profilsiden alle roller deler. Bruker
// GET /me sin egen kommentar for hvorfor den API-ruten IKKE brukes her: den
// returnerer bare de fire øktfeltene, ikke visningsnavn/tidssone/e-post —
// server-komponenten kaller derfor getMyProfile() direkte, samme mønster
// som resten av kodebasen i natt.
export default async function MePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const session = await getCurrentSession();
  if (!session) {
    redirect(`/${locale}/logg-inn`);
  }

  const profile = await getMyProfile(session.userId);
  if (!profile) {
    redirect(`/${locale}/logg-inn`);
  }

  const journalistProfile =
    session.role === "journalist" ? await getJournalistProfile(session.userId) : null;

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("me.title")}</h1>

      <div className={styles.readOnly}>
        <span>
          {t("me.email_label")}: {profile.email}
        </span>
        <span>
          {t("me.country_label")}: {t(profile.countryNameKey)}
        </span>
      </div>

      <ProfileForm
        locale={locale}
        availableLocales={profile.availableLocales}
        initial={{
          displayName: profile.displayName ?? "",
          locale: profile.locale,
          timezone: profile.timezone ?? "",
        }}
      />

      {session.role === "recipient" ? (
        <Link href={`/${locale}/me/bytt-land`} className={buttonClassName("secondary")}>
          {t("me.change_country_link")}
        </Link>
      ) : null}

      {session.role === "journalist" && journalistProfile ? (
        <section>
          <h2 className={styles.sectionTitle}>{t("me.journalist_profile_title")}</h2>
          <JournalistProfileForm
            locale={locale}
            verificationStatus={journalistProfile.verificationStatus}
            initial={{
              fullName: journalistProfile.fullName,
              jobTitle: journalistProfile.jobTitle,
              organizationName: journalistProfile.organizationName,
              organizationUrl: journalistProfile.organizationUrl,
            }}
          />
        </section>
      ) : null}

      <DeleteAccountSection locale={locale} />
    </main>
  );
}
