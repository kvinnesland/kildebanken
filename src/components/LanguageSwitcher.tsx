"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import styles from "./LanguageSwitcher.module.css";

// DESIGN.md 6: "LanguageSwitcher" i minimumssettet. Bytter BARE
// locale-segmentet i den nåværende stien og beholder resten uendret — riktig
// i dag fordi rute-segmentene selv ikke er oversatt per locale ennå
// (SPEC-V1.md 3.7, et kjent, notert hull i NATTLOGG.md). Den dagen 3.7 lukkes
// må denne slå opp riktig oversatt sti i stedet for å anta at kun det første
// segmentet endres.
export function LanguageSwitcher({ locale }: { locale: SupportedLocale }) {
  const pathname = usePathname();
  const t = createTranslator(locale);

  function pathForLocale(target: SupportedLocale): string {
    const segments = pathname.split("/");
    segments[1] = target;
    return segments.join("/") || "/";
  }

  return (
    <nav aria-label={t("common.language_switcher.label")} className={styles.switcher}>
      {SUPPORTED_LOCALES.map((code) => (
        <Link
          key={code}
          href={pathForLocale(code)}
          aria-current={code === locale ? "true" : undefined}
          className={code === locale ? styles.active : styles.link}
        >
          {t(`locale.name.${code}`)}
        </Link>
      ))}
    </nav>
  );
}
