// Next.js sitt offisielle instrumenteringshook (App Router). register()
// kalles én gang av Next.js selv per kjøretidsmiljø (node og edge bygges
// hver for seg) — ikke noe applikasjonskode kaller direkte.
//
// Sentry (INFRASTRUCTURE.md 3/16.8: vedtatt leverandør for
// feilrapportering, EU-region) var frem til nå kun en tom SENTRY_DSN i
// .env.example uten noen faktisk kobling — se NATTLOGG.md. Uten en reell
// DSN sender SDK-en aldri noe (samme "trygt uten nøkkel"-prinsipp som
// src/lib/email/send.ts), så dette er trygt å ha stående i alle miljøer,
// inkludert Stadium 0 med null brukere.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0, // kun feilrapportering ennå, ingen ytelsessporing
  });
}

export const onRequestError = Sentry.captureRequestError;
