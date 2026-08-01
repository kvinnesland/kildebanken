import { redirect } from "next/navigation";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { getCurrentSession } from "@/lib/auth/session";
import { searchUsersByEmail } from "@/lib/moderation/users";
import { EmptyState } from "@/components/EmptyState";
import { SearchForm } from "./SearchForm";
import { RecipientRow } from "./RecipientRow";
import styles from "./page.module.css";

// GET /[locale]/admin/recipients (SPEC-V1.md 16.2, "Mottakere": "søk på
// e-postadresse, se kontostatus og samtykkehistorikk, gjennomfør sletting,
// suspender ved misbruk"). Søket skjer via URL-en (`?email=`), samme
// mønster som CountrySelector.tsx sitt landvalg — siden forblir én enkelt
// server-rendret forespørsel per søk, ingen klientside-datahenting.
export default async function AdminRecipientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);
  const { email: emailQuery } = await searchParams;

  const session = await getCurrentSession();
  if (!session || (session.role !== "moderator" && session.role !== "admin")) {
    redirect(`/${locale}/logg-inn`);
  }

  const hasQuery = Boolean(emailQuery && emailQuery.trim());
  const results = hasQuery ? await searchUsersByEmail(session, emailQuery!) : [];

  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("admin.recipients.title")}</h1>

      <SearchForm locale={locale} initialQuery={emailQuery ?? ""} />

      {!hasQuery ? (
        <EmptyState
          title={t("admin.recipients.empty_title")}
          description={t("admin.recipients.empty_description")}
        />
      ) : results.length === 0 ? (
        <EmptyState
          title={t("admin.recipients.no_results_title")}
          description={t("admin.recipients.no_results_description")}
        />
      ) : (
        <ul className={styles.list}>
          {results.map((user) => (
            <RecipientRow
              key={user.id}
              locale={locale}
              user={{
                id: user.id,
                email: user.email,
                status: user.status,
                statusLabel: t(`admin.recipients.status.${user.status}`),
                createdLabel: dateFormatter.format(user.createdAt),
                consentLines: user.consents.map((consent) => {
                  const isActive = consent.granted && !consent.withdrawnAt;
                  const statusLabel = t(
                    isActive ? "admin.recipients.consent_granted" : "admin.recipients.consent_withdrawn"
                  );
                  const typeLabel = t(`admin.recipients.consent_type.${consent.consentType}`);
                  const date = dateFormatter.format(consent.withdrawnAt ?? consent.grantedAt);
                  return `${typeLabel}: ${statusLabel} (${date})`;
                }),
              }}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
