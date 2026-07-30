import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { SiteHeader } from "@/components/SiteHeader";

// Delt topptekst for hele /[locale]/admin-området — se
// src/app/[locale]/journalist/layout.tsx for samme mønster og begrunnelse.
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);

  return (
    <>
      <SiteHeader
        locale={locale}
        navLinks={[
          { href: `/${locale}/admin/journalists`, label: t("admin.journalists.title") },
          { href: `/${locale}/admin/requests`, label: t("admin.requests.title") },
        ]}
      />
      {children}
    </>
  );
}
