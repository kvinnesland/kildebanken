import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { SiteHeader } from "@/components/SiteHeader";

// Delt topptekst for hele /[locale]/journalist-området — se SiteHeader.tsx
// for hvorfor dette IKKE ligger i rot-layouten. Selve tilgangskontrollen
// (krever en aktiv journalist-økt) håndheves fortsatt av hver enkelt
// page.tsx, ikke her — unngår å duplisere den sjekken to steder.
export default async function JournalistLayout({
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
          { href: `/${locale}/journalist/requests`, label: t("journalist.requests.title") },
          { href: `/${locale}/me`, label: t("nav.my_account") },
        ]}
      />
      {children}
    </>
  );
}
