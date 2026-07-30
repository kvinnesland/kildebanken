// Ren funksjon, ingen andre importer — se mønsteret etablert i
// src/lib/http/safe-redirect.ts (NATTLOGG.md, økt 5): rene hjelpefunksjoner
// bor isolert, ikke inni en fil med tunge sideeffekter.

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

/**
 * Genererer en URL-vennlig slug fra en tittel. Norske spesialtegn
 * transkriberes (æ→ae, ø→o, å→aa) i stedet for å fjernes, slik at ordet
 * fortsatt er lesbart i URL-en — se eksempelet i SPEC-V1.md 32.
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replaceAll("æ", "ae")
    .replaceAll("ø", "o")
    .replaceAll("å", "aa")
    .normalize("NFKD")
    .replace(COMBINING_DIACRITICS, "") // fjerner gjenværende diakritiske tegn
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/**
 * Legger til et kort, deterministisk suffiks når basisslug-en allerede er
 * tatt. `attempt` teller opp (2, 3, …) — kalleren prøver `baseSlug`, så
 * `withDisambiguator(baseSlug, 2)` osv. til en ledig slug er funnet.
 */
export function withDisambiguator(baseSlug: string, attempt: number): string {
  return `${baseSlug}-${attempt}`;
}
