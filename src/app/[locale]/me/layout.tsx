import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { getCurrentSession } from "@/lib/auth/session";
import { SiteHeader, type SiteHeaderNavLink } from "@/components/SiteHeader";

// /[locale]/me er nåbar fra ALLE roller (i motsetning til /journalist og
// /admin, som er egne, rolle-spesifikke områder) — nav-lenkene her varierer
// derfor per rolle, i stedet for én fast liste slik de to andre layoutene
// har. Selve tilgangskontrollen håndheves fortsatt av page.tsx.
export default async function MeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const session = await getCurrentSession();

  const navLinks: SiteHeaderNavLink[] = [];
  if (session?.role === "journalist") {
    navLinks.push({ href: `/${locale}/journalist/requests`, label: t("journalist.requests.title") });
  } else if (session?.role === "moderator" || session?.role === "admin") {
    navLinks.push(
      { href: `/${locale}/admin/journalists`, label: t("admin.journalists.title") },
      { href: `/${locale}/admin/requests`, label: t("admin.requests.title") }
    );
  }

  return (
    <>
      <SiteHeader locale={locale} navLinks={navLinks} />
      {children}
    </>
  );
}
