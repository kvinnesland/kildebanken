import type { Metadata } from "next";
import { headers } from "next/headers";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import "@/styles/globals.css";

export const metadata: Metadata = {
  // "Kildebanken" er kun arbeidstittel — skal ikke bygges inn i arkitekturen
  // (SPEC-V1.md 2). Erstatt når navn er besluttet; se DESIGN.md 10.1.
  title: "Kildebanken",
  description: "Plattform for journalistforespørsler og ekspertkilder",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang={locale}>
      <body>
        {/* nonce videreformidles slik at eventuelle inline-script-tagger vi
            selv legger til senere (ikke Next.js sine egne) kan bruke samme
            CSP-nonce som middleware genererte, se src/middleware.ts. */}
        <div data-csp-nonce={nonce}>{children}</div>
      </body>
    </html>
  );
}
