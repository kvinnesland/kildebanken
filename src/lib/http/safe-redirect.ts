// Ingen andre importer med hensikt — denne skal kunne testes isolert uten å
// dra inn noe som helst annet i modulgrafen (se NATTLOGG.md, økt 5: en
// tidligere versjon lå inne i route.ts og trakk med seg hele
// "server-only"-kjeden via session.ts når den ble importert i en test).

/**
 * Godtar bare interne, relative stier — aldri en ekstern URL eller
 * protokoll-relativ "//evil.com". Brukes der et brukerstyrt søkeparameter
 * (`to`, `redirect`, e.l.) skal bli et redirect-mål.
 */
export function isSafeRelativePath(value: string | null): value is string {
  return !!value && value.startsWith("/") && !value.startsWith("//");
}
