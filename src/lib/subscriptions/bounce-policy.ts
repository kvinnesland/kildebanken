// Ren funksjon, ingen andre importer (samme mønster som
// src/lib/http/safe-redirect.ts) — den ENESTE regelen fra SPEC-V1.md 10.3
// som faktisk krever egen forretningslogikk (resten er rene statusbytter).

// "Tre myke bounces på rad behandles som hard bounce" (10.3).
export const SOFT_BOUNCE_STREAK_TO_HARD_BOUNCE = 3;

/**
 * Gitt antall SAMMENHENGENDE myke bounces registrert FØR denne nye — altså
 * før den bounce-en som nettopp skjedde telles med — avgjør om den nye
 * bounce-en skal eskaleres til hard bounce.
 */
export function shouldEscalateToHardBounce(consecutiveSoftBouncesBeforeThisOne: number): boolean {
  return consecutiveSoftBouncesBeforeThisOne + 1 >= SOFT_BOUNCE_STREAK_TO_HARD_BOUNCE;
}
