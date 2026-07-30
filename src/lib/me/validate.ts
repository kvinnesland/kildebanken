// Ren funksjon, ingen andre importer (se src/lib/http/safe-redirect.ts for
// hvorfor dette mønsteret brukes for hjelpefunksjoner som skal testes
// isolert). Validerer en IANA-tidssone ved å la Intl selv avgjøre
// gyldigheten — det finnes ingen komplett, stabil liste å sammenligne mot i
// kildekoden som ikke fort blir utdatert.
export function isValidTimezone(timezone: string): boolean {
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
