import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Locale routing is handled by src/middleware.ts and the /app/[locale]
  // segment, not by Next.js' built-in i18n config — see SPEC-V1.md 3.7 and
  // DESIGN.md/INFRASTRUCTURE.md 16.8 (no host-specific routing primitives).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

// Sentry (INFRASTRUCTURE.md 3/16.8, se src/instrumentation.ts). Kildekart-
// opplasting krever SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN mot en
// ekte Sentry-konto — ingen av dem er satt ennå (Stadium 0, null brukere),
// så opplastingen er eksplisitt slått av her i stedet for å la plugin-en
// prøve og feile stille mot et manglende prosjekt. next build skal aldri
// avhenge av at en ekstern tjeneste svarer.
export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
