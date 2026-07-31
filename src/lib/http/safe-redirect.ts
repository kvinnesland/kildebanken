// Ingen andre importer med hensikt — denne skal kunne testes isolert uten å
// dra inn noe som helst annet i modulgrafen (se NATTLOGG.md, økt 5: en
// tidligere versjon lå inne i route.ts og trakk med seg hele
// "server-only"-kjeden via session.ts når den ble importert i en test).

/**
 * Godtar bare interne, relative stier — aldri en ekstern URL eller
 * protokoll-relativ "//evil.com". Brukes der et brukerstyrt søkeparameter
 * (`to`, `redirect`, e.l.) skal bli et redirect-mål.
 *
 * To omgåelser en enkel `startsWith("//")`-sjekk IKKE fanger, begge
 * bekreftet empirisk mot Node sin `URL`-parser (samme WHATWG-implementasjon
 * som selve redirect-kallet bruker, `new URL(value, origin)`):
 *
 * 1. Baklengs skråstrek ("\") oppfører seg som fremover skråstrek for
 *    "spesielle" skjema (http/https) i denne posisjonen — "/\evil.com"
 *    tolkes derfor akkurat som "//evil.com", et protokoll-relativt mål.
 *    Kun i POSISJON 1 (rett etter den innledende skråstreken) — en
 *    skråstrek/baklengs skråstrek senere i stien er bare et ordinært
 *    sti-skille.
 * 2. WHATWG URL-spesifikasjonen fjerner ethvert ASCII tab/linjeskift fra
 *    HELE strengen (ikke bare start/slutt) FØR parsing — "/\t/evil.com"
 *    (tab som andre tegn) blir dermed "//evil.com" i parserens øyne, selv
 *    om strengen selv aldri bokstavelig starter med "//".
 */
export function isSafeRelativePath(value: string | null): value is string {
  if (!value) return false;
  const normalized = value.replace(/[\t\n\r]/g, "");
  if (!normalized.startsWith("/")) return false;
  const second = normalized[1];
  return second === undefined || (second !== "/" && second !== "\\");
}
