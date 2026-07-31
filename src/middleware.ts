import { NextResponse, type NextRequest } from "next/server";
import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/i18n/config";
import { resolveLocalizedRequestPath } from "@/i18n/localized-paths";

// Tre ansvar, bevisst holdt sammen fordi alle må skje før noe rendres:
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
// 3. Øktcookiens glidende utløp (SPEC-V1.md 6.1: "fornyes ved bruk", lagt
//    til økt 7 — se NATTLOGG.md). `src/lib/auth/session.ts` sin
//    `getCurrentSession()` skyver allerede DATABASE-radens `expires_at`/
//    `last_used_at` frem ved hver bruk, men kan IKKE selv fornye
//    `kb_session`-INFORMASJONSKAPSELENS egen nettleser-utløpsdato — Next.js
//    tillater `cookies().set()` kun fra en Server Action/Route Handler, og
//    den funksjonen kalles også fra vanlige Server Component-sider der et
//    slikt kall ville kastet. Middleware kan derimot alltid sette
//    responscookies, uansett hvilken side/rute som til slutt rendres — se
//    `renewSessionCookie()` under. Fornyer BEVISST BLINDT, uten noe
//    databasekall her: selve informasjonskapselens levetid er bare en
//    nettleser-side overlevelseshint, ALDRI den egentlige autoriteten — den
//    er (og var allerede før dette) `sessions.expires_at`/`revoked_at`,
//    sjekket server-side i `getCurrentSession()` ved hvert faktisk bruk. Å
//    forlenge en informasjonskapsel som PEKER på en økt databasen uansett
//    vil avvise som utløpt/tilbakekalt, gir ingen ekstra tilgang — det gjør
//    bare at nettleseren beholder den litt lenger uten effekt. (Dette
//    gjelder likt for moderator/administrator også: deres økt fornyes
//    ALDRI i databasen — 6.3 — så selv om cookien deres nettleser-side får
//    samme 30-dagers levetid som mottaker/journalist, vil
//    `getCurrentSession()` fortsatt korrekt avvise den etter 12 timer.)
//
// Kjører i Node.js-runtime, ikke edge — se next.config.mjs. Dette er bevisst:
// edge-runtime støtter ikke `pg` (node-postgres), og landspesifikk logikk her
// vil før eller siden trenge databasetilgang.
export const config = {
  // `/api` var tidligere ekskludert — inkludert nå (økt 7) utelukkende for
  // punkt 3 over, slik at en bruker som BARE gjør API-kall (ingen sidevisning
  // i mellom) også får cookien sin fornyet. `middleware()` selv hopper
  // eksplisitt over lokalrutings-/CSP-logikken for `/api`-stier under, så
  // punkt 1 og 2 sin oppførsel er UENDRET for alle andre stier.
  matcher: ["/((?!_next|favicon.ico|.*\\..*).*)"],
};

const LOCALE_COOKIE = "kb_locale";
const SESSION_COOKIE = "kb_session"; // må holdes i sync med src/lib/auth/session.ts
const SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 dager, se punkt 3 over

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api")) {
    const response = NextResponse.next();
    renewSessionCookie(request, response);
    return response;
  }

  const nonce = generateNonce();
  const response = routeLocale(request) ?? routeLocalizedRequestPath(request) ?? NextResponse.next();

  renewSessionCookie(request, response);
  response.headers.set("x-nonce", nonce);
  response.headers.set("Content-Security-Policy", buildCsp(nonce));

  return response;
}

function renewSessionCookie(request: NextRequest, response: NextResponse): void {
  const rawToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (!rawToken) return;

  response.cookies.set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
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
