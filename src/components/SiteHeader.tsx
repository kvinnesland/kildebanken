import Link from "next/link";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LogoutButton } from "./LogoutButton";
import styles from "./SiteHeader.module.css";

export interface SiteHeaderNavLink {
  href: string;
  label: string;
}

// Delt topptekst for de INNLOGGEDE områdene (/journalist, /admin) — IKKE
// lagt i rot-layouten ennå, siden den offentlige forsiden bevisst er en
// plassholder frem til Fase 2-forsidedesignet (se page.tsx sin kommentar,
// SPEC-V1.md 24). `nav.requests` (en i18n-nøkkel fra økt 1) er fjernet
// (økt 7, se NATTLOGG.md) — ingen offentlig "bla i forespørsler"-side
// finnes eller skal finnes (11: oppdagelse skjer kun via digesten), og
// journalistens/moderatorens EGNE lenker til sine forespørselslister
// bruker mer presise, kontekstspesifikke tekster
// (`journalist.requests.title` m.fl.) satt av hver kallende layout, ikke
// en generisk `nav.*`-nøkkel.
export function SiteHeader({
  locale,
  navLinks,
}: {
  locale: SupportedLocale;
  navLinks: SiteHeaderNavLink[];
}) {
  const t = createTranslator(locale);

  return (
    <header className={styles.header}>
      <Link href={`/${locale}`} className={styles.homeLink}>
        {t("nav.home")}
      </Link>
      <nav className={styles.nav}>
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href} className={styles.navLink}>
            {link.label}
          </Link>
        ))}
      </nav>
      <LanguageSwitcher locale={locale} />
      <LogoutButton locale={locale} />
    </header>
  );
}
