import { redirect } from "next/navigation";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { getCurrentSession } from "@/lib/auth/session";
import { listAllCountries } from "@/lib/admin/countries";
import { listLegalDocumentsForCountry } from "@/lib/admin/legal-documents";
import { EmptyState } from "@/components/EmptyState";
import { CreateCountryForm } from "./CreateCountryForm";
import { CountryCard } from "./CountryCard";
import styles from "./page.module.css";

// GET /[locale]/admin/countries (SPEC-V1.md 16.2: "Land (kun
// administrator): opprette og redigere landkonfigurasjon, sette status,
// tildele moderatorer, publisere nye versjoner av juridiske dokumenter").
// Det siste, mest sensitive av de tre opprinnelig helt manglende
// admin-seksjonene (natt til 2026-08-01, se NATTLOGG.md) — bygget SIST og
// med egen forsiktighet, siden dette endrer juridisk-dokument-status og
// landkonfigurasjon ekte brukere stoler på. KUN administrator, til forskjell
// fra de tre andre admin-sidene (som slipper inn moderator også) — 16.2
// sier det eksplisitt ("kun administrator"), og alle lib-funksjonene denne
// siden kaller håndhever det samme via requireAdmin() uansett, men siden
// selv skal ikke engang VISES for en moderator.
export default async function AdminCountriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const session = await getCurrentSession();
  if (!session || session.role !== "admin") {
    redirect(`/${locale}/logg-inn`);
  }

  const countriesResult = await listAllCountries();
  const allCountries = countriesResult.ok ? countriesResult.countries : [];
  const sorted = [...allCountries].sort((a, b) => a.code.localeCompare(b.code));

  const documentsByCountry = new Map(
    await Promise.all(
      sorted.map(async (country) => {
        const result = await listLegalDocumentsForCountry(country.code);
        return [country.code, result.ok ? result.documents : []] as const;
      })
    )
  );

  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("admin.countries.title")}</h1>

      <CreateCountryForm locale={locale} />

      {sorted.length === 0 ? (
        <EmptyState
          title={t("admin.countries.empty_title")}
          description={t("admin.countries.empty_description")}
        />
      ) : (
        <ul className={styles.list}>
          {sorted.map((country) => (
            <CountryCard
              key={country.code}
              locale={locale}
              country={{
                code: country.code,
                nameKey: country.nameKey,
                defaultLocale: country.defaultLocale,
                availableLocales: country.availableLocales,
                timezone: country.timezone,
                minimumAge: country.minimumAge,
                digestSendTime: country.digestSendTime,
                senderNameKey: country.senderNameKey,
                supportEmail: country.supportEmail,
                status: country.status,
                statusLabel: t(`admin.countries.status.${country.status}`),
              }}
              supportedLocales={[...SUPPORTED_LOCALES]}
              documents={(documentsByCountry.get(country.code) ?? []).map((doc) => ({
                id: doc.id,
                rowLabel: t("admin.countries.legal_document_row_label", {
                  type: t(`admin.countries.legal_document_type.${doc.documentType}`),
                  locale: doc.locale,
                  version: doc.version,
                  date: dateFormatter.format(doc.publishedAt),
                }),
              }))}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
