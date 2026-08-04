const EMAIL_PATTERN = /[^\s"'<>]+@[^\s"'<>]+\.[^\s"'<>]+/g;

/**
 * INFRASTRUCTURE.md 10: "Personopplysninger logges ikke: ingen
 * e-postadresser, ingen svartekst." Enhver feil fanget i tick.ts/
 * retention.ts sine jobbløkker havner i et `errors: string[]` som til
 * slutt JSON.stringify'es og logges av netlify/functions/tick.ts (og av
 * runTick() sitt eget dry-run-varsel) — reelt hull frem til nå (se
 * NATTLOGG.md, økt 94): en rå `(err as Error).message` ble alltid pushet
 * uendret, uansett kilde. Både en leverandørfeil fra Brevo (som i
 * prinsippet kan ekko tilbake den avviste mottakerens adresse i selve
 * feilteksten) og enkelte Postgres-feilmeldinger (som kan inkludere
 * kolonneverdien ved et unikhetsbrudd) kan dermed ha inneholdt en ekte
 * e-postadresse. Fjerner ethvert e-postformet mønster FØR meldingen
 * noensinne havner i et errors-array — en generell reservesperre, ikke en
 * avhengighet av å kjenne alle mulige feiltekstformater fra hver
 * leverandør/driver på forhånd.
 */
export function sanitizeErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(EMAIL_PATTERN, "[e-post fjernet]");
}
