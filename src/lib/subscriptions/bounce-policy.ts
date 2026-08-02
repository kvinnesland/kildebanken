// Den ENESTE terskelen fra SPEC-V1.md 10.3 som faktisk krever egen
// forretningslogikk (resten er rene statusbytter) — selve
// sammenligningen skjer nå direkte i email-events.ts, mot den ATOMISK
// oppdaterte telleren fra databasen (se kommentaren der for hvorfor: en
// tidligere "les så skriv"-versjon av denne sjekken hadde et reelt tapt-
// oppdatering-kappløp mellom to nesten samtidige myke bounce-hendelser
// for samme abonnement).

// "Tre myke bounces på rad behandles som hard bounce" (10.3).
export const SOFT_BOUNCE_STREAK_TO_HARD_BOUNCE = 3;
