// Next.js sitt klient-instrumenteringshook (App Router, >=15.3) — lastes
// automatisk av Next.js før hydrering, ingen egen import noe sted trengs.
// Se src/instrumentation.ts for samme resonnement om SENTRY_DSN.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
});

// Krevd av SDK-en for å instrumentere ruteoverganger — vi sporer ikke
// ytelse (tracesSampleRate: 0 over), men eksporten må finnes eller SDK-en
// advarer i hvert eneste bygg.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
