import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
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

  it("createCountry(): avviser en kode som allerede finnes", async () => {
    await ensureTestCountry();
    const admin = await createAdmin(TEST_COUNTRY_CODE);
    await loginAs(admin.id);

    const result = await createCountry(testCountryInput({ code: TEST_COUNTRY_CODE }));

    expect(result).toEqual({ ok: false, error: "errors.already_exists" });
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
  });
});
