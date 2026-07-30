import { NextResponse, type NextRequest } from "next/server";
import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/i18n/config";
import { resolveLocalizedRequestPath } from "@/i18n/localized-paths";

// To ansvar, bevisst holdt sammen fordi begge må skje før noe rendres:
//
// 1. Locale-ruting (SPEC-V1.md 3.7): rot-URL uten prefiks videresender basert
//    på Accept-Language, med en språkvelger som overstyrer via cookie.
//    NB: dette er BARE språkvalg — hvilket LAND brukeren tilhører er en
//    separat beslutning (kontostatus / cookie satt av landvelgeren), aldri
//    utledet herfra. Se 3.1.
//
// 2. CSP med nonce (SPEC-V1.md 18: "CSP uten unsafe-inline"). Next.js
//    injiserer noen inline script-tagger for hydrering, så en nonce må
//    genereres per request og sendes både i header og til rendering.
//
// Kjører i Node.js-runtime, ikke edge — se next.config.mjs. Dette er bevisst:
// edge-runtime støtter ikke `pg` (node-postgres), og landspesifikk logikk her
// vil før eller siden trenge databasetilgang.
export const config = {
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)"],
};

const LOCALE_COOKIE = "kb_locale";

export function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const response = routeLocale(request) ?? routeLocalizedRequestPath(request) ?? NextResponse.next();

  response.headers.set("x-nonce", nonce);
  response.headers.set("Content-Security-Policy", buildCsp(nonce));

  return response;
}

function routeLocale(request: NextRequest): NextResponse | undefined {
  const { pathname } = request.nextUrl;

  const pathnameHasLocale = SUPPORTED_LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );
  if (pathnameHasLocale) return undefined;

  const locale = resolveRequestedLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(url);
}

// SPEC-V1.md 3.7: offentlige forespørsel-stier har oversatte segmentnavn per
// locale (/nb-NO/foresporsler/... vs /en-GB/requests/...), men det faktiske
// mappenavnet i src/app/[locale]/... er fortsatt nb-NO sitt ord — se
// src/i18n/localized-paths.ts for selve oversettelseslogikken (ren og
// enhetstestet der). Kjører KUN når `routeLocale()` over har bekreftet at
// stien allerede har et locale-prefiks.
function routeLocalizedRequestPath(request: NextRequest): NextResponse | undefined {
  const { pathname } = request.nextUrl;
  const locale = pathname.split("/").filter(Boolean)[0];
  if (!locale || !isSupportedLocale(locale)) return undefined;

  const action = resolveLocalizedRequestPath(pathname, locale);
  if (!action) return undefined;

  const url = request.nextUrl.clone();
  url.pathname = action.pathname;
  return action.kind === "rewrite" ? NextResponse.rewrite(url) : NextResponse.redirect(url, 308);
}

function resolveRequestedLocale(request: NextRequest): string {
  const cookieOverride = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieOverride && (SUPPORTED_LOCALES as readonly string[]).includes(cookieOverride)) {
    return cookieOverride;
  }

  const negotiator = new Negotiator({
    headers: { "accept-language": request.headers.get("accept-language") ?? "" },
  });
  const requestedLanguages = negotiator.languages();

  try {
    return match(requestedLanguages, SUPPORTED_LOCALES, PLATFORM_DEFAULT_LOCALE);
  } catch {
    return PLATFORM_DEFAULT_LOCALE;
  }
}

function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

function buildCsp(nonce: string): string {
  // Ingen tredjepartsskript (DESIGN.md 3, "fontene selvhostes"). Ingen
  // 'unsafe-inline' på script-src — nonce dekker Next.js sine egne
  // hydreringsscript.
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'", // fjernes når komponentstilene er fullt CSS-modul-basert
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
