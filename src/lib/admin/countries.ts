import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, countries, legalDocuments, moderatorCountries, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/authorize";

export type CountryActionResult = { ok: true } | { ok: false; error: string };

// GET /admin/countries (SPEC-V1.md 16.2, 20) — "kun administrator", ingen
// landfiltrering (i motsetning til f.eks. listModerationQueue()).
export async function listAllCountries(): Promise<
  { ok: true; countries: (typeof countries.$inferSelect)[] } | { ok: false; error: string }
> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "errors.not_authorized" };

  return { ok: true, countries: await db.select().from(countries) };
}

export interface CreateCountryInput {
  code: string;
  nameKey: string;
  defaultLocale: string;
  availableLocales: string[];
  timezone: string;
  minimumAge: number;
  digestSendTime: string;
  senderNameKey: string;
  supportEmail: string;
}

/**
 * POST /admin/countries (3.3). Opprettes ALLTID i `draft` — "et land i
 * draft er usynlig for alle utenom administrator" er nettopp poenget med at
 * et nytt land ikke kan opprettes direkte som `active`. Aktivering er en
 * egen, senere handling (`setCountryStatus()`) med egne forutsetninger.
 */
export async function createCountry(input: CreateCountryInput): Promise<CountryActionResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "errors.not_authorized" };

  if (!input.availableLocales.includes(input.defaultLocale)) {
    return { ok: false, error: "errors.validation_failed" };
  }

  const [existing] = await db
    .select({ code: countries.code })
    .from(countries)
    .where(eq(countries.code, input.code))
    .limit(1);
  if (existing) return { ok: false, error: "errors.already_exists" };

  await db.insert(countries).values({ ...input, status: "draft" });

  // FR-050: "logge alle moderator- og administratorhandlinger ... med
  // land." Manglet i hele src/lib/admin/ frem til nå — et reelt hull
  // oppdaget ved å spore audit_logs bakover (se NATTLOGG.md, økt 7).
  await db.insert(auditLogs).values({
    actorType: "user",
    actorUserId: session.userId,
    countryCode: input.code,
    action: "country.create",
    entityType: "country",
    entityId: input.code,
  });

  return { ok: true };
}

export interface UpdateCountryInput {
  nameKey?: string;
  defaultLocale?: string;
  availableLocales?: string[];
  timezone?: string;
  minimumAge?: number;
  digestSendTime?: string;
  senderNameKey?: string;
  supportEmail?: string;
}

// PATCH /admin/countries/:code — redigering av landkonfigurasjon (3.3).
// Statusbytte går via `setCountryStatus()`, IKKE denne, siden det har egne
// forutsetninger som ikke skal kunne omgås ved et vanlig felt-PATCH.
export async function updateCountry(
  code: string,
  input: UpdateCountryInput
): Promise<CountryActionResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "errors.not_authorized" };

  const [existing] = await db.select().from(countries).where(eq(countries.code, code)).limit(1);
  if (!existing) return { ok: false, error: "errors.not_found" };

  const nextDefaultLocale = input.defaultLocale ?? existing.defaultLocale;
  const nextAvailableLocales = input.availableLocales ?? existing.availableLocales;
  if (!nextAvailableLocales.includes(nextDefaultLocale)) {
    return { ok: false, error: "errors.validation_failed" };
  }

  await db
    .update(countries)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(countries.code, code));

  await db.insert(auditLogs).values({
    actorType: "user",
    actorUserId: session.userId,
    countryCode: code,
    action: "country.update",
    entityType: "country",
    entityId: code,
  });

  return { ok: true };
}

/**
 * Statusbytte (3.3, draft | active | paused). Overgang til `active`
 * håndhever de kodesjekkbare forutsetningene: juridisk gjennomgåtte
 * (=publiserte) vilkår OG personvernerklæring i HVERT tilgjengelige språk,
 * og minst én tildelt moderator. "Komplette oversettelser" og "juridisk
 * gjennomgått" for øvrig er ikke noe denne funksjonen kan verifisere
 * automatisk (menneskelig vurdering, hhv. i18n-nøkler i en helt annen del av
 * kodebasen) — det er fortsatt en manuell forutsetning administrator har
 * ansvar for før kallet, som spec-en selv sier (3.3, ordrett).
 */
export async function setCountryStatus(
  code: string,
  status: "draft" | "active" | "paused"
): Promise<CountryActionResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "errors.not_authorized" };

  const [existing] = await db.select().from(countries).where(eq(countries.code, code)).limit(1);
  if (!existing) return { ok: false, error: "errors.not_found" };

  if (status === "active") {
    for (const locale of existing.availableLocales) {
      for (const documentType of ["terms", "privacy"] as const) {
        const [doc] = await db
          .select({ id: legalDocuments.id })
          .from(legalDocuments)
          .where(
            and(
              eq(legalDocuments.countryCode, code),
              eq(legalDocuments.locale, locale),
              eq(legalDocuments.documentType, documentType)
            )
          )
          .limit(1);
        if (!doc) return { ok: false, error: "errors.legal_documents_unavailable" };
      }
    }

    const [moderatorAssignment] = await db
      .select({ countryCode: moderatorCountries.countryCode })
      .from(moderatorCountries)
      .where(eq(moderatorCountries.countryCode, code))
      .limit(1);
    if (!moderatorAssignment) return { ok: false, error: "errors.no_moderator_assigned" };
  }

  await db.update(countries).set({ status, updatedAt: new Date() }).where(eq(countries.code, code));

  await db.insert(auditLogs).values({
    actorType: "user",
    actorUserId: session.userId,
    countryCode: code,
    action: "country.status_change",
    entityType: "country",
    entityId: code,
    metadata: { status },
  });

  return { ok: true };
}

/**
 * POST /admin/countries/:code/moderators. Spec-en sier at administrator
 * "tildeler moderatorer" (16.2), men sier ingenting om HVORDAN en
 * moderatorkonto oppstår i utgangspunktet — det finnes ingen
 * selvregistrering for rollen (kun mottaker og journalist, 7.1/7.2).
 * Antagelse tatt her (se NATTLOGG.md): admin oppgir en e-postadresse.
 * Finnes ingen bruker med den fra før, opprettes én med `role = moderator`,
 * `status = active` (administrator-provisjonert, ingen egen
 * e-postbekreftelse å vente på). Finnes brukeren men med en ANNEN rolle,
 * avvises kallet — å stille-om en eksisterende mottaker- eller
 * journalistkonto til moderator er en for stor, tillitssensitiv endring til
 * å gjøre implisitt via denne ruten.
 */
export async function assignModeratorToCountry(
  code: string,
  email: string
): Promise<CountryActionResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "errors.not_authorized" };

  const [country] = await db.select().from(countries).where(eq(countries.code, code)).limit(1);
  if (!country) return { ok: false, error: "errors.not_found" };

  const [existingUser] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let moderatorUserId: string;
  if (existingUser) {
    if (existingUser.role !== "moderator") return { ok: false, error: "errors.validation_failed" };
    moderatorUserId = existingUser.id;
  } else {
    const [created] = await db
      .insert(users)
      .values({
        email,
        role: "moderator",
        status: "active",
        countryCode: code,
        locale: country.defaultLocale,
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    if (!created) throw new Error("insert av moderator returnerte ingen rad");
    moderatorUserId = created.id;
  }

  await db
    .insert(moderatorCountries)
    .values({ moderatorUserId, countryCode: code })
    .onConflictDoNothing();

  await db.insert(auditLogs).values({
    actorType: "user",
    actorUserId: session.userId,
    countryCode: code,
    action: "country.assign_moderator",
    entityType: "user",
    entityId: moderatorUserId,
  });

  return { ok: true };
}
