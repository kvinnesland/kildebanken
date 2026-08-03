import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, countries, legalDocuments, moderatorCountries, users } from "@/db/schema";
import { isUniqueViolation } from "@/db/errors";
import { requireAdmin } from "@/lib/auth/authorize";
import { isSupportedLocale } from "@/i18n/config";
import { isValidTimezone } from "@/lib/me/validate";

export type CountryActionResult = { ok: true } | { ok: false; error: string };

// `digestSendTime` (schema.ts: plain `text`, ingen DB-nivå formathåndhevelse)
// sammenlignes som en RÅ STRENG mot `localTimeHHMM` i runDigestTick()
// (jobs/tick.ts: `localTimeHHMM < country.digestSendTime`) — IKKE parset til
// tall. `localTimeHHMM` er ALLTID nullutfylt to-sifret "HH:MM" (Intl sin
// "2-digit"-formattering), så strengsammenligningen virker KORREKT bare hvis
// `digestSendTime` også er akkurat det formatet. En verdi UTEN nullutfylling
// (f.eks. "7:00" i stedet for "07:00") ville ikke krasjet noe sted — den
// ville stille fått ALLE døgnets kloge-klokkeslett (som alle starter med
// sifferet 0, 1 eller 2) til å lekseskografisk sammenlignes som "mindre enn"
// "7:00" (siden '0'/'1'/'2' < '7' i ASCII), og dermed la denne digest-tikkets
// gate ALDRI slippe gjennom for det landet — ingen daglig utsendelse i det
// hele tatt, for alltid, uten en eneste feilmelding noe sted. Reelt hull
// (samme kveld som `timezone`-valideringen over) i selve
// UI-inntastingsfeltet (`CreateCountryForm.tsx` sitt `digestSendTime`-felt
// er et vanlig tekstfelt, ikke en native `<input type="time">` som ville
// nullutfylt automatisk).
const DIGEST_SEND_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

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
  // FR-029, SPEC-V1.md 9.2. Valgfritt her (i motsetning til feltene over) —
  // utelates den, faller innsettingen tilbake til DB-kolonnens egen
  // DEFAULT 5 (schema.ts), samme tall spec-en selv begrunner i 26.1 punkt 5.
  maxConcurrentPublishedRequests?: number;
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
  // 19.1 (lagt til natt til 2026-08-02, se NATTLOGG.md): en tagg plattformen
  // ikke har oversettelser for ville krasjet ingenting (alle forbrukere av
  // en locale faller allerede tilbake til nb-NO), men ville latt en bruker
  // "velge" et språk som stille aldri faktisk ble brukt noe sted.
  if (!input.availableLocales.every(isSupportedLocale)) {
    return { ok: false, error: "errors.unsupported_locale" };
  }
  // Reelt hull frem til nå: `timezone` ble aldri validert som en faktisk
  // IANA-sone verken her eller i updateCountry() under — en admin-skrivefeil
  // (f.eks. "Europe/Osloo") ville ikke feilet HER, men først langt senere,
  // som en uhåndtert `RangeError` fra `Intl.DateTimeFormat` inne i
  // `zonedWallTimeToUtc()`/`utcToZonedWallTime()` (datetime/timezone.ts) —
  // altså først når en journalist i DETTE landet faktisk prøver å sette
  // eller vise en svarfrist. Samme mønster og begrunnelse som
  // `errors.unsupported_locale`-sjekken over. `isValidTimezone()`
  // (me/validate.ts) er allerede den etablerte valideringsfunksjonen —
  // brukt for brukerens EGEN tidssone-preferanse i PATCH /me — gjenbrukt
  // her i stedet for å skrive en ny variant.
  if (!isValidTimezone(input.timezone)) {
    return { ok: false, error: "errors.invalid_timezone" };
  }
  // Se DIGEST_SEND_TIME_PATTERN sin egen kommentar over.
  if (!DIGEST_SEND_TIME_PATTERN.test(input.digestSendTime)) {
    return { ok: false, error: "errors.validation_failed" };
  }
  // FR-029: må være et positivt heltall — en verdi på 0 ville gjort det
  // umulig for landets journalister å noensinne publisere noe som helst.
  if (
    input.maxConcurrentPublishedRequests !== undefined &&
    (!Number.isInteger(input.maxConcurrentPublishedRequests) || input.maxConcurrentPublishedRequests < 1)
  ) {
    return { ok: false, error: "errors.validation_failed" };
  }

  const [existing] = await db
    .select({ code: countries.code })
    .from(countries)
    .where(eq(countries.code, input.code))
    .limit(1);
  if (existing) return { ok: false, error: "errors.already_exists" };

  try {
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
  } catch (err) {
    // Dekker race conditions mot sjekken over (to administratorer som
    // oppretter samme landkode samtidig) — samme mønster som
    // registration/recipient.ts og registration/journalist.ts: databasens
    // unike constraint på `countries.code` (primærnøkkel) er den egentlige
    // garantien, sjekken over er bare en tidlig, vennligere feilvei. Uten
    // denne fangsten ville den tapende forespørselen krasjet med en
    // uhåndtert 23505 i stedet for å få den samme, forventede
    // errors.already_exists-responsen som den vinnende sjekken gir.
    if (isUniqueViolation(err)) {
      return { ok: false, error: "errors.already_exists" };
    }
    throw err;
  }
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
  // FR-029, SPEC-V1.md 9.2 — se CreateCountryInput sin egen kommentar.
  maxConcurrentPublishedRequests?: number;
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
  // Samme begrunnelse som createCountry() (se der).
  if (!nextAvailableLocales.every(isSupportedLocale)) {
    return { ok: false, error: "errors.unsupported_locale" };
  }
  // Samme begrunnelse som createCountry() (se der) — kun valider hvis
  // `timezone` faktisk er del av DENNE PATCH-en, ikke det eksisterende,
  // allerede lagrede feltet.
  if (input.timezone !== undefined && !isValidTimezone(input.timezone)) {
    return { ok: false, error: "errors.invalid_timezone" };
  }
  // Samme begrunnelse som createCountry() (se DIGEST_SEND_TIME_PATTERN).
  if (input.digestSendTime !== undefined && !DIGEST_SEND_TIME_PATTERN.test(input.digestSendTime)) {
    return { ok: false, error: "errors.validation_failed" };
  }
  // Samme begrunnelse som createCountry() (se der).
  if (
    input.maxConcurrentPublishedRequests !== undefined &&
    (!Number.isInteger(input.maxConcurrentPublishedRequests) || input.maxConcurrentPublishedRequests < 1)
  ) {
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
        // publishedAt <= now() — samme "gjeldende"-definisjon som
        // getCurrentLegalDocument() (src/lib/legal/documents.ts) bruker.
        // publishLegalDocument() setter i dag alltid publishedAt til "nå",
        // så et fremtidsdatert dokument kan ikke oppstå via applikasjonen
        // selv ennå — men denne sjekken skal bety det samme som "gjeldende
        // dokument finnes" uansett, slik at den ikke blir en felle den dagen
        // fremtidsplanlagt publisering eventuelt bygges.
        const [doc] = await db
          .select({ id: legalDocuments.id })
          .from(legalDocuments)
          .where(
            and(
              eq(legalDocuments.countryCode, code),
              eq(legalDocuments.locale, locale),
              eq(legalDocuments.documentType, documentType),
              lte(legalDocuments.publishedAt, new Date())
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
    try {
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
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Samme bug-klasse som createCountry()/updateDraft() (se NATTLOGG.md):
      // to administratorer som tildeler SAMME nye e-post som moderator
      // omtrent samtidig kunne begge passere `existingUser`-sjekken over før
      // noen av dem rakk å skrive, og den tapende INSERT-en ville krasjet på
      // users.email sin unike constraint. Henter i stedet raden den vinnende
      // forespørselen nettopp opprettet — samme resultat uansett hvem som
      // "vant".
      const [raced] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (!raced || raced.role !== "moderator") return { ok: false, error: "errors.validation_failed" };
      moderatorUserId = raced.id;
    }
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
