import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { moderatorCountries } from "@/db/schema";
import { getCurrentSession, type CurrentSession } from "./session";

/**
 * Henter gjeldende økt og krever at brukeren er moderator FOR DET OPPGITTE
 * LANDET, eller administrator (som har tilgang til alle land — 19.4:
 * "Administrator trenger ingen rader her"). Returnerer `null` hvis ikke.
 *
 * Brukes av alle admin-/moderator-endepunkter som handler på noe knyttet
 * til ett bestemt land (SPEC-V1.md 4: "En moderator er tildelt ett eller
 * flere land og ser bare køer og brukere tilhørende disse").
 */
export async function requireModeratorForCountry(
  countryCode: string
): Promise<CurrentSession | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  if (session.role === "admin") return session;
  if (session.role !== "moderator") return null;

  const [assignment] = await db
    .select({ countryCode: moderatorCountries.countryCode })
    .from(moderatorCountries)
    .where(
      and(
        eq(moderatorCountries.moderatorUserId, session.userId),
        eq(moderatorCountries.countryCode, countryCode)
      )
    )
    .limit(1);

  return assignment ? session : null;
}

/**
 * Krever administrator spesifikt — IKKE moderator, uansett tildelt land.
 * Brukes av landstyringsfunksjonene i src/lib/admin/ (16.2: "Land (kun
 * administrator)"), til forskjell fra `requireModeratorForCountry()` som
 * bevisst tillater begge roller for landspesifikke moderasjonshandlinger.
 */
export async function requireAdmin(): Promise<CurrentSession | null> {
  const session = await getCurrentSession();
  if (!session || session.role !== "admin") return null;
  return session;
}

export type ModeratorCountryCheck =
  | { status: "ok"; session: CurrentSession }
  | { status: "wrong_country" }
  | { status: "unauthorized" };

/**
 * Som `requireModeratorForCountry()`, men skiller mellom TO ulike
 * feilårsaker som den funksjonen slår sammen til én `null`:
 *
 * - `"unauthorized"`: ingen økt i det hele tatt, eller en økt med en rolle
 *   som aldri kan bli moderator/administrator.
 * - `"wrong_country"`: en GYLDIG moderatorøkt, men ikke tildelt DETTE
 *   landet.
 *
 * FR-023 (SPEC-V1.md 22, med eksplisitt akseptansekriterium: "moderator for
 * NO får 404 på en forespørsel i SE") krever at en moderator tildelt et
 * annet land skal få nøyaktig samme respons som om ressursen ikke fantes i
 * det hele tatt (`errors.not_found`, 404) — IKKE en respons som bekrefter
 * at ressursen finnes et annet sted (`errors.not_authorized`, 403). Brukes
 * foreløpig bare av de forespørsels-modererende funksjonene i
 * `moderation/requests.ts`/`requests/requests.ts` (den eneste ressursen
 * FR-023 selv nevner eksplisitt) — se NATTLOGG.md for en åpen vurdering av
 * om samme skille bør gjelde journalist-/mottaker-/svar-/digest-
 * modereringsfunksjonene også, som i dag fortsatt bruker den delte,
 * ikke-skillende `requireModeratorForCountry()` uendret.
 */
export async function checkModeratorForCountry(countryCode: string): Promise<ModeratorCountryCheck> {
  const session = await getCurrentSession();
  if (!session) return { status: "unauthorized" };
  if (session.role === "admin") return { status: "ok", session };
  if (session.role !== "moderator") return { status: "unauthorized" };

  const [assignment] = await db
    .select({ countryCode: moderatorCountries.countryCode })
    .from(moderatorCountries)
    .where(
      and(
        eq(moderatorCountries.moderatorUserId, session.userId),
        eq(moderatorCountries.countryCode, countryCode)
      )
    )
    .limit(1);

  return assignment ? { status: "ok", session } : { status: "wrong_country" };
}

/** Landene en moderator er tildelt. Tom liste for administrator betyr "alle
 * land" — det skal IKKE tolkes som "ingen land". Se kallere. */
export async function getAssignedCountryCodes(session: CurrentSession): Promise<string[] | "all"> {
  if (session.role === "admin") return "all";

  const rows = await db
    .select({ countryCode: moderatorCountries.countryCode })
    .from(moderatorCountries)
    .where(eq(moderatorCountries.moderatorUserId, session.userId));

  return rows.map((r) => r.countryCode);
}
