import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyMagicLink } from "@/lib/auth/magic-link";
import { createSession } from "@/lib/auth/session";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";

const bodySchema = z.object({ token: z.string().min(1) });

// POST /auth/verify (SPEC-V1.md 20). Ett bruk, deretter ugyldig — se
// auth.verify.already_used / auth.verify.expired i i18n-meldingene.
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "errors.generic" }, { status: 400 });
  }

  const verified = await verifyMagicLink(parsed.data.token);
  if (!verified) {
    return NextResponse.json({ error: "auth.verify.expired" }, { status: 401 });
  }

  const { expiresAt } = await createSession(verified.userId, verified.role);

  return NextResponse.json({ ok: true, expiresAt });
}

/**
 * GET /api/auth/verify?token=... — den FAKTISKE lenken magic link-e-posten
 * peker til (POST-varianten over kan ikke klikkes direkte fra en
 * e-postklient). Samme mønster som GET /api/digest-access/:token: tokenet
 * verifiseres og økten opprettes HER, i en ekte Route Handler — et Server
 * Component-sideoppsett kan IKKE kalle `cookies().set()` (Next.js kaster
 * "Cookies can only be modified in a Server Action or Route Handler",
 * oppdaget ved faktisk å teste flyten i en nettleser, ikke antatt).
 * Videresender til sidens locale-forside ved suksess, eller tilbake til
 * innloggingssiden med en feilmarkør ved ugyldig/utløpt/brukt token.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const requestedLocale = url.searchParams.get("locale");
  const fallbackLocale =
    requestedLocale && isSupportedLocale(requestedLocale) ? requestedLocale : PLATFORM_DEFAULT_LOCALE;

  const verified = token ? await verifyMagicLink(token) : null;

  if (!verified) {
    return NextResponse.redirect(new URL(`/${fallbackLocale}/logg-inn?feil=utlopt`, url.origin));
  }

  await createSession(verified.userId, verified.role);

  const locale = isSupportedLocale(verified.locale) ? verified.locale : fallbackLocale;
  return NextResponse.redirect(new URL(`/${locale}`, url.origin));
}
