import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

// Tokens skal aldri lagres rått (SPEC-V1.md 24.3) — bare hashen. Selve
// tokenet eksisterer kun i URL-en/cookien brukeren har, og i minnet i det
// korte øyeblikket det verifiseres.

const TOKEN_BYTES = 32; // 256 bit — tilfeldig og ikke-gjettbar (24.3)

/** Genererer et nytt, url-trygt engangstoken. Returnerer RÅTT token — kalleren
 * må selv hashe det før lagring (`hashToken`) og bare sende det rå tokenet
 * til brukeren (e-post/cookie). */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Konstant-tid sammenligning for å unngå timing-angrep ved verifisering. */
export function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
