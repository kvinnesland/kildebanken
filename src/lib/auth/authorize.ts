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
