import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);

  // Midlertidig plassholder — erstattes når det offentlige forsidedesignet
  // er bygget (Fase 2, SPEC-V1.md 24). Beviser at locale-ruting,
  // meldingslasting og designtokens faktisk henger sammen ende-til-ende.
  return (
    <main style={{ padding: "var(--space-6)", maxWidth: "var(--measure)" }}>
      <h1 style={{ fontFamily: "var(--font-editorial)", fontSize: "var(--text-3xl)" }}>
        {t("common.app_name_temporary")}
      </h1>
      <p style={{ color: "var(--color-text-muted)" }}>
        {locale} — {t("digest.intro")}
      </p>
    </main>
  );
}
