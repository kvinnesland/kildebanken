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

export default nextConfig;
