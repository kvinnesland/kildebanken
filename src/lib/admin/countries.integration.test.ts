import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, countries, legalDocuments, moderatorCountries, sessions, users } from "@/db/schema";
import { ensureTestCountry, TEST_COUNTRY_CODE, uniqueTestEmail } from "@/db/integration/fixtures";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import {
  assignModeratorToCountry,
  createCountry,
  listAllCountries,
  setCountryStatus,
  updateCountry,
  type CreateCountryInput,
} from "./countries";

// Samme mønster som resten av admin/moderation-testene: mocker
// next/headers for å simulere en innlogget administrator via en EKTE
// sessions-rad, siden alle fem funksjonene kaller requireAdmin() internt.
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
import { cookies } from "next/headers";

async function loginAs(userId: string): Promise<void> {
  const rawToken = generateToken();
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) => (name === "kb_session" ? { name, value: rawToken } : undefined),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

// Moderatorer opprettet av createActiveUser("moderator", ...) OG av
// assignModeratorToCountry() (som selv oppretter en ny brukerkonto når
// e-posten ikke finnes fra før) ryddes samlet i én afterAll nederst i
// filen — se createdModeratorIds sin egen kommentar. Reelt hull frem til
// nå (se NATTLOGG.md, samme mønster som ni andre testfiler): denne filen
// bruker `uniqueTestEmail(role)` med en DYNAMISK rolleparameter, ikke den
// bokstavelige `uniqueTestEmail("moderator")`-formen de andre filene
// hadde — derfor ble den ikke fanget opp av det første søket som
// oppdaget mønsteret.
const createdModeratorIds: string[] = [];
// Administratorer opprettet via createAdmin() (som selv kaller
// createActiveUser("admin", ...)) ryddes samlet i SAMME afterAll —
// samme opprydningshull, oppdaget ved en full-database-måling som viste
// 2404 opphopede role='admin'-rader på tvers av filene (se NATTLOGG.md).
const createdAdminIds: string[] = [];

async function createActiveUser(
  role: "recipient" | "journalist" | "moderator" | "admin",
  countryCode: string
): Promise<{ id: string; email: string }> {
  const [user] = await db
    .insert(users)
    .values({
      email: uniqueTestEmail(role),
      role,
      status: "active",
      countryCode,
      locale: "nb-NO",
      emailVerifiedAt: new Date(),
    })
    .returning({ id: users.id, email: users.email });
  if (!user) throw new Error(`Klarte ikke opprette test-${role}`);
  if (role === "moderator") createdModeratorIds.push(user.id);
  if (role === "admin") createdAdminIds.push(user.id);
  return user;
}

async function createAdmin(countryCode: string): Promise<{ id: string; email: string }> {
  return createActiveUser("admin", countryCode);
}

function testCountryInput(overrides: Partial<CreateCountryInput> = {}): CreateCountryInput {
  return {
    code: `Z${randomUUID().slice(0, 6).toUpperCase()}`,
    nameKey: "country.test.name",
    defaultLocale: "nb-NO",
    availableLocales: ["nb-NO"],
    timezone: "Europe/Oslo",
    minimumAge: 18,
    digestSendTime: "07:00",
    senderNameKey: "email.sender_name.test",
    supportEmail: "test@example.invalid",
    ...overrides,
  };
}

// Rydder i AVHENGIGHETSREKKEFØLGE — audit_logs/moderator_countries/
// legal_documents refererer alle til countries.code, og har ingen ON
// DELETE CASCADE (bevisst, se schema.ts), så en sletting av selve
// landraden feiler på en fremmednøkkel-konflikt med mindre disse fjernes
// først.
async function deleteTestCountry(code: string): Promise<void> {
  await db.delete(auditLogs).where(eq(auditLogs.countryCode, code));
  await db.delete(moderatorCountries).where(eq(moderatorCountries.countryCode, code));
  await db.delete(legalDocuments).where(eq(legalDocuments.countryCode, code));
  await db.delete(countries).where(eq(countries.code, code));
}

describe("admin/countries.ts mot ekte Postgres", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("listAllCountries(): nektes uten en administrator-økt", async () => {
    await ensureTestCountry();
    const moderator = await createActiveUser("moderator", TEST_COUNTRY_CODE);
    await loginAs(moderator.id);

    const result = await listAllCountries();

    expect(result).toEqual({ ok: false, error: "errors.not_authorized" });
  });

  it("listAllCountries(): en administrator ser alle land, uten landfiltrering", async () => {
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);

    const result = await listAllCountries();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.countries.some((c) => c.code === TEST_COUNTRY_CODE)).toBe(true);
    }
  });

  it("createCountry(): opprettes ALLTID i draft, uansett input", async () => {
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);
    const input = testCountryInput();

    const result = await createCountry(input);

    expect(result).toEqual({ ok: true });
    const [created] = await db.select().from(countries).where(eq(countries.code, input.code));
    expect(created?.status).toBe("draft");

    await deleteTestCountry(input.code);
  });

  it("createCountry(): avviser når standardspråket ikke er blant tilgjengelige språk", async () => {
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);
    const input = testCountryInput({ defaultLocale: "en-GB", availableLocales: ["nb-NO"] });

    const result = await createCountry(input);

    expect(result).toEqual({ ok: false, error: "errors.validation_failed" });
  });

  it("createCountry(): avviser en language-tagg plattformen ikke har oversettelser for (19.1)", async () => {
    // Ingen forbruker av en locale ville krasjet på dette (alle faller
    // defensivt tilbake til nb-NO for en ukjent tagg — se
    // src/i18n/get-messages.ts og tick.ts), men uten denne sperren kunne en
    // administrator konfigurert et land der en bruker "velger" et språk som
    // stille aldri faktisk ble brukt noe sted.
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);
    const input = testCountryInput({ availableLocales: ["nb-NO", "fr-FR"] });

    const result = await createCountry(input);

    expect(result).toEqual({ ok: false, error: "errors.unsupported_locale" });
    const [notCreated] = await db.select().from(countries).where(eq(countries.code, input.code));
    expect(notCreated).toBeUndefined();
  });

  it("createCountry(): avviser en ugyldig tidssone (skrivefeil ville ellers krasjet FØRST ved en journalists svarfrist-innsending)", async () => {
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);
    const input = testCountryInput({ timezone: "Europe/Osloo" });

    const result = await createCountry(input);

    expect(result).toEqual({ ok: false, error: "errors.invalid_timezone" });
    const [notCreated] = await db.select().from(countries).where(eq(countries.code, input.code));
    expect(notCreated).toBeUndefined();
  });

  it("createCountry(): avviser digestSendTime uten nullutfylling (ville ellers stille deaktivert digesten permanent — se DIGEST_SEND_TIME_PATTERN i countries.ts)", async () => {
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);
    const input = testCountryInput({ digestSendTime: "7:00" });

    const result = await createCountry(input);

    expect(result).toEqual({ ok: false, error: "errors.validation_failed" });
    const [notCreated] = await db.select().from(countries).where(eq(countries.code, input.code));
    expect(notCreated).toBeUndefined();
  });

  it("createCountry(): avviser en kode som allerede finnes", async () => {
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);

    const result = await createCountry(testCountryInput({ code: TEST_COUNTRY_CODE }));

    expect(result).toEqual({ ok: false, error: "errors.already_exists" });
  });

  it("createCountry(): nøyaktig ÉN av mange SAMTIDIGE forsøk med samme kode lykkes, aldri en uhåndtert feil (race-beskyttelsen, ikke bare forhåndssjekken)", async () => {
    // Flere administratorer (eller flere faner) som samtidig oppretter
    // samme landkode kunne passere "finnes fra før"-sjekken før noen av dem
    // rakk å skrive — uten fangsten på databasens unike constraint på
    // countries.code (primærnøkkel) ville de tapende forespørslene krasjet
    // med en uhåndtert 23505 i stedet for et forventet errors.already_exists.
    // 10 samtidige kall (samme mønster som rate-limit.integration.test.ts
    // sin 20-samtidige advisory-lås-test) for pålitelig å treffe det
    // faktiske kappløpsvinduet, ikke bare den sekvensielle forhåndssjekken.
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);
    const input = testCountryInput();

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => createCountry(input))
    );

    for (const result of results) {
      expect(result.status).toBe("fulfilled");
    }
    const values = results.map((r) => (r.status === "fulfilled" ? r.value : null));
    expect(values.filter((v) => v?.ok)).toHaveLength(1);
    for (const v of values) {
      if (v && !v.ok) expect(v.error).toBe("errors.already_exists");
    }

    const rows = await db.select().from(countries).where(eq(countries.code, input.code));
    expect(rows).toHaveLength(1);

    await deleteTestCountry(input.code);
  });

  it("updateCountry(): oppdaterer feltene, og logger revisjonshandlingen", async () => {
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);
    const input = testCountryInput();
    await createCountry(input);

    const result = await updateCountry(input.code, { supportEmail: "ny-epost@example.invalid" });

    expect(result).toEqual({ ok: true });
    const [after] = await db.select().from(countries).where(eq(countries.code, input.code));
    expect(after?.supportEmail).toBe("ny-epost@example.invalid");

    await deleteTestCountry(input.code);
  });

  it("updateCountry(): avviser når det oppdaterte standardspråket ikke lenger er tilgjengelig", async () => {
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);
    const input = testCountryInput({ availableLocales: ["nb-NO", "en-GB"], defaultLocale: "nb-NO" });
    await createCountry(input);

    const result = await updateCountry(input.code, { availableLocales: ["en-GB"] });

    expect(result).toEqual({ ok: false, error: "errors.validation_failed" });

    await deleteTestCountry(input.code);
  });

  it("updateCountry(): avviser en language-tagg plattformen ikke har oversettelser for (19.1)", async () => {
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);
    const input = testCountryInput();
    await createCountry(input);

    const result = await updateCountry(input.code, { availableLocales: ["nb-NO", "fr-FR"] });

    expect(result).toEqual({ ok: false, error: "errors.unsupported_locale" });
    const [after] = await db.select().from(countries).where(eq(countries.code, input.code));
    expect(after?.availableLocales).toEqual(["nb-NO"]);

    await deleteTestCountry(input.code);
  });

  it("updateCountry(): avviser en ugyldig tidssone", async () => {
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);
    const input = testCountryInput();
    await createCountry(input);

    const result = await updateCountry(input.code, { timezone: "Europe/Osloo" });

    expect(result).toEqual({ ok: false, error: "errors.invalid_timezone" });
    const [after] = await db.select().from(countries).where(eq(countries.code, input.code));
    expect(after?.timezone).toBe("Europe/Oslo");

    await deleteTestCountry(input.code);
  });

  it("updateCountry(): avviser digestSendTime uten nullutfylling", async () => {
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);
    const input = testCountryInput();
    await createCountry(input);

    const result = await updateCountry(input.code, { digestSendTime: "7:00" });

    expect(result).toEqual({ ok: false, error: "errors.validation_failed" });
    const [after] = await db.select().from(countries).where(eq(countries.code, input.code));
    expect(after?.digestSendTime).toBe("07:00");

    await deleteTestCountry(input.code);
  });

  it("updateCountry(): errors.not_found for en ikke-eksisterende landkode", async () => {
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);

    const result = await updateCountry("ZZ", { supportEmail: "ny@example.invalid" });

    expect(result).toEqual({ ok: false, error: "errors.not_found" });
  });

  it("setCountryStatus(): nekter aktivering uten publiserte juridiske dokumenter", async () => {
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);
    const input = testCountryInput();
    await createCountry(input);

    const result = await setCountryStatus(input.code, "active");

    expect(result).toEqual({ ok: false, error: "errors.legal_documents_unavailable" });

    await deleteTestCountry(input.code);
  });

  it("setCountryStatus(): nekter aktivering uten en tildelt moderator, selv med dokumenter på plass", async () => {
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);
    const input = testCountryInput();
    await createCountry(input);
    for (const documentType of ["terms", "privacy"] as const) {
      await db.insert(legalDocuments).values({
        countryCode: input.code,
        locale: "nb-NO",
        documentType,
        version: "1.0.0",
        body: "Testtekst.",
        publishedAt: new Date(),
      });
    }

    const result = await setCountryStatus(input.code, "active");

    expect(result).toEqual({ ok: false, error: "errors.no_moderator_assigned" });

    await deleteTestCountry(input.code);
  });

  it("setCountryStatus(): aktiverer når BÅDE dokumenter og moderator er på plass", async () => {
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);
    const input = testCountryInput();
    await createCountry(input);
    for (const documentType of ["terms", "privacy"] as const) {
      await db.insert(legalDocuments).values({
        countryCode: input.code,
        locale: "nb-NO",
        documentType,
        version: "1.0.0",
        body: "Testtekst.",
        publishedAt: new Date(),
      });
    }
    const moderator = await createActiveUser("moderator", TEST_COUNTRY_CODE);
    await db.insert(moderatorCountries).values({ moderatorUserId: moderator.id, countryCode: input.code });

    const result = await setCountryStatus(input.code, "active");

    expect(result).toEqual({ ok: true });
    const [after] = await db.select().from(countries).where(eq(countries.code, input.code));
    expect(after?.status).toBe("active");

    await deleteTestCountry(input.code);
  });

  it("setCountryStatus(): nekter aktivering når et dokument finnes, men er FREMTIDSDATERT (ikke gjeldende ennå)", async () => {
    // publishLegalDocument() setter i dag alltid publishedAt til "nå", så
    // dette scenarioet kan ikke oppstå via applikasjonen selv — men
    // getCurrentLegalDocument() (src/lib/legal/documents.ts) definerer
    // "gjeldende" strengt som publishedAt <= now(), og setCountryStatus()
    // sin egen aktiveringssjekk skal bety det samme, ikke bare "en rad
    // finnes". Setter inn raden direkte for å teste selve sjekken isolert.
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);
    const input = testCountryInput();
    await createCountry(input);
    await db.insert(legalDocuments).values({
      countryCode: input.code,
      locale: "nb-NO",
      documentType: "terms",
      version: "1.0.0",
      body: "Testtekst.",
      publishedAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await db.insert(legalDocuments).values({
      countryCode: input.code,
      locale: "nb-NO",
      documentType: "privacy",
      version: "1.0.0",
      body: "Testtekst.",
      publishedAt: new Date(),
    });
    const moderator = await createActiveUser("moderator", TEST_COUNTRY_CODE);
    await db.insert(moderatorCountries).values({ moderatorUserId: moderator.id, countryCode: input.code });

    const result = await setCountryStatus(input.code, "active");

    expect(result).toEqual({ ok: false, error: "errors.legal_documents_unavailable" });
    const [after] = await db.select().from(countries).where(eq(countries.code, input.code));
    expect(after?.status).toBe("draft");

    await deleteTestCountry(input.code);
  });

  it("assignModeratorToCountry(): oppretter en NY moderatorkonto når e-posten ikke finnes fra før", async () => {
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);
    const email = uniqueTestEmail("ny-moderator");

    const result = await assignModeratorToCountry(TEST_COUNTRY_CODE, email);

    expect(result).toEqual({ ok: true });
    const [created] = await db.select().from(users).where(eq(users.email, email));
    expect(created?.role).toBe("moderator");
    expect(created?.status).toBe("active");
    if (created) createdModeratorIds.push(created.id);
    const [assignment] = await db
      .select()
      .from(moderatorCountries)
      .where(eq(moderatorCountries.moderatorUserId, created!.id));
    expect(assignment?.countryCode).toBe(TEST_COUNTRY_CODE);
  });

  it("assignModeratorToCountry(): avviser å gjøre om en EKSISTERENDE journalist/mottaker til moderator", async () => {
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);
    const existingRecipient = await createActiveUser("recipient", TEST_COUNTRY_CODE);

    const result = await assignModeratorToCountry(TEST_COUNTRY_CODE, existingRecipient.email);

    expect(result).toEqual({ ok: false, error: "errors.validation_failed" });
  });

  it("assignModeratorToCountry(): er idempotent for en allerede tildelt moderator", async () => {
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);
    const email = uniqueTestEmail("dobbel-moderator");
    await assignModeratorToCountry(TEST_COUNTRY_CODE, email);

    const result = await assignModeratorToCountry(TEST_COUNTRY_CODE, email);

    expect(result).toEqual({ ok: true });
    const [created] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (created) createdModeratorIds.push(created.id);
  });

  it("assignModeratorToCountry(): nøyaktig ÉN brukerrad opprettes når SAMME nye e-post tildeles samtidig, aldri en uhåndtert feil", async () => {
    // To administratorer som tildeler samme, helt nye e-post som moderator
    // omtrent samtidig kunne begge passere "finnes fra før"-sjekken før
    // noen av dem rakk å skrive — uten fangsten på databasens unike
    // constraint på users.email ville den tapende INSERT-en krasjet med en
    // uhåndtert 23505. Samme mønster som createCountry()-samtidighetstesten
    // over.
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);
    const email = uniqueTestEmail("samtidig-moderator");

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => assignModeratorToCountry(TEST_COUNTRY_CODE, email))
    );

    for (const result of results) {
      expect(result.status).toBe("fulfilled");
      if (result.status === "fulfilled") expect(result.value).toEqual({ ok: true });
    }

    const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    expect(rows).toHaveLength(1);
    if (rows[0]) createdModeratorIds.push(rows[0].id);
  });
});

// Rydder ALLE moderatorer/administratorer opprettet i denne filen (via
// createActiveUser, createAdmin() og assignModeratorToCountry(), alle
// sporet i createdModeratorIds/createdAdminIds) — se deres egne
// kommentarer. auditLogs/sessions FØRST, av samme grunn som de andre
// testfilene denne natten (users.id har ingen kaskadesletting).
afterAll(async () => {
  const allIds = [...createdModeratorIds, ...createdAdminIds];
  if (allIds.length === 0) return;
  await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, allIds));
  await db.delete(sessions).where(inArray(sessions.userId, allIds));
  await db.delete(moderatorCountries).where(inArray(moderatorCountries.moderatorUserId, createdModeratorIds));
  await db.delete(users).where(inArray(users.id, allIds));
});
