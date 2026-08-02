import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, countries, emailSubscriptions, legalDocuments, sessions, users } from "@/db/schema";
import { ensureTestCountry, TEST_COUNTRY_CODE, uniqueTestEmail } from "@/db/integration/fixtures";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import {
  listLegalDocumentsForCountry,
  publishLegalDocument,
  type PublishLegalDocumentInput,
} from "./legal-documents";

// Unike versjonsstrenger per kall — legal_documents har en UNIQUE-indeks på
// (land, locale, type, versjon). Kjøring nummer to av samme test ville
// ellers kollidert med rader forrige kjøring lot stå igjen (denne filen
// rydder bevisst ikke opp i de publiserte dokumentene — se
// fixtures.ts sin egen kommentar om at dette er et akseptert unntak, ikke et
// fullverdig testrammeverk).
function uniqueVersion(): string {
  return `test-${randomUUID()}`;
}

// Samme mønster som resten av admin/moderation-testene.
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

async function createAdmin(): Promise<{ id: string }> {
  const [admin] = await db
    .insert(users)
    .values({
      email: uniqueTestEmail("admin"),
      role: "admin",
      status: "active",
      countryCode: TEST_COUNTRY_CODE,
      locale: "nb-NO",
      emailVerifiedAt: new Date(),
    })
    .returning({ id: users.id });
  if (!admin) throw new Error("Klarte ikke opprette test-administrator");
  return admin;
}

function documentInput(overrides: Partial<PublishLegalDocumentInput> = {}): PublishLegalDocumentInput {
  return {
    countryCode: TEST_COUNTRY_CODE,
    locale: "nb-NO",
    documentType: "terms",
    version: uniqueVersion(),
    body: "Oppdatert testtekst.",
    isMaterialChange: false,
    ...overrides,
  };
}

describe("publishLegalDocument mot ekte Postgres", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("nektes uten en administrator-økt", async () => {
    await ensureTestCountry();
    const [nonAdmin] = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("moderator"),
        role: "moderator",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    await loginAs(nonAdmin!.id);

    try {
      const result = await publishLegalDocument(documentInput());
      expect(result).toEqual({ ok: false, error: "errors.not_authorized" });
    } finally {
      // Reelt hull frem til nå (se NATTLOGG.md): denne moderatoren ble
      // aldri ryddet bort, ulikt den bevisste unntaksbegrunnelsen for
      // publiserte dokumenter over (som IKKE gjelder denne brukeren).
      await db.delete(sessions).where(eq(sessions.userId, nonAdmin!.id));
      await db.delete(users).where(eq(users.id, nonAdmin!.id));
    }
  });

  it("avviser tom tekst eller tomt versjonsnummer", async () => {
    await ensureTestCountry();
    const admin = await createAdmin();
    await loginAs(admin.id);

    const result = await publishLegalDocument(documentInput({ body: "   " }));

    expect(result).toEqual({ ok: false, error: "errors.validation_failed" });
  });

  it("avviser en ukjent landkode", async () => {
    await ensureTestCountry();
    const admin = await createAdmin();
    await loginAs(admin.id);

    const result = await publishLegalDocument(documentInput({ countryCode: "ZZ" }));

    expect(result).toEqual({ ok: false, error: "errors.invalid_country" });
  });

  it("nøyaktig ÉN av mange SAMTIDIGE publiseringer av SAMME versjon lykkes, aldri en uhåndtert feil", async () => {
    // publishLegalDocument() har ingen forhåndssjekk i det hele tatt (i
    // motsetning til createCountry()) — den unike indeksen på
    // (countryCode, locale, documentType, version) er selve garantien mot
    // dobbel publisering, f.eks. en administrator som dobbeltklikker
    // "Publiser". Uten en fangst på den ville alle-utenom-én av disse
    // krasjet med en uhåndtert 23505.
    await ensureTestCountry();
    const admin = await createAdmin();
    await loginAs(admin.id);
    const input = documentInput();

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => publishLegalDocument(input))
    );

    for (const result of results) {
      expect(result.status).toBe("fulfilled");
    }
    const values = results.map((r) => (r.status === "fulfilled" ? r.value : null));
    expect(values.filter((v) => v?.ok)).toHaveLength(1);
    for (const v of values) {
      if (v && !v.ok) expect(v.error).toBe("errors.already_exists");
    }

    const rows = await db
      .select({ id: legalDocuments.id })
      .from(legalDocuments)
      .where(
        and(
          eq(legalDocuments.countryCode, input.countryCode),
          eq(legalDocuments.locale, input.locale),
          eq(legalDocuments.documentType, input.documentType),
          eq(legalDocuments.version, input.version)
        )
      );
    expect(rows).toHaveLength(1);
  });

  it("publiserer en NY versjon uten å røre eksisterende versjoner (17.2), og logger revisjonshandlingen", async () => {
    await ensureTestCountry();
    const admin = await createAdmin();
    await loginAs(admin.id);

    const version = uniqueVersion();
    const result = await publishLegalDocument(documentInput({ version }));

    expect(result).toEqual({ ok: true });
    const versions = await db
      .select()
      .from(legalDocuments)
      .where(eq(legalDocuments.countryCode, TEST_COUNTRY_CODE));
    expect(versions.some((v) => v.version === version)).toBe(true);
    // Testversjonen fra ensureTestCountry() (1.0.0) skal fortsatt finnes uendret.
    expect(versions.some((v) => v.version === "1.0.0")).toBe(true);

    const published = versions.find((v) => v.version === version);
    const [log] = await db
      .select()
      .from(auditLogs)
      .where(
        and(eq(auditLogs.action, "legal_document.publish"), eq(auditLogs.entityId, published!.id))
      );
    expect(log?.actorUserId).toBe(admin.id);
  });

  it("varsler IKKE mottakere når isMaterialChange er false", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const admin = await createAdmin();
    await loginAs(admin.id);
    const [recipient] = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("recipient"),
        role: "recipient",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    await db.insert(emailSubscriptions).values({
      userId: recipient!.id,
      status: "active",
      unsubscribeTokenHash: hashToken(generateToken()),
    });

    await publishLegalDocument(documentInput({ isMaterialChange: false }));

    expect(
      warnSpy.mock.calls.some((call) => String(call[0]).includes("legal_terms_material_change"))
    ).toBe(false);
  });

  it("varsler AKTIVE mottakere i RIKTIG land og locale når isMaterialChange er true (17.2)", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const admin = await createAdmin();
    await loginAs(admin.id);
    const [recipient] = await db
      .insert(users)
      .values({
        email: uniqueTestEmail("recipient"),
        role: "recipient",
        status: "active",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    await db.insert(emailSubscriptions).values({
      userId: recipient!.id,
      status: "active",
      unsubscribeTokenHash: hashToken(generateToken()),
    });

    const result = await publishLegalDocument(
      documentInput({ isMaterialChange: true, documentType: "terms" })
    );

    expect(result).toEqual({ ok: true });
    expect(
      warnSpy.mock.calls.some((call) => String(call[0]).includes("legal_terms_material_change"))
    ).toBe(true);
  });

  it("varsler IKKE ved en vesentlig endring i journalist_terms (bevisst avgrenset, se NATTLOGG.md)", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ensureTestCountry();
    const admin = await createAdmin();
    await loginAs(admin.id);

    const result = await publishLegalDocument(
      documentInput({ isMaterialChange: true, documentType: "journalist_terms" })
    );

    expect(result).toEqual({ ok: true });
    expect(
      warnSpy.mock.calls.some((call) => String(call[0]).includes("legal_terms_material_change"))
    ).toBe(false);
  });
});

describe("listLegalDocumentsForCountry mot ekte Postgres", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("nektes uten en administrator-økt", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const result = await listLegalDocumentsForCountry(TEST_COUNTRY_CODE);

    expect(result).toEqual({ ok: false, error: "errors.not_authorized" });
  });

  it("returnerer ALLE versjoner for landet, nyeste først, uten å filtrere på gjeldende status", async () => {
    await ensureTestCountry();
    const admin = await createAdmin();
    await loginAs(admin.id);

    const olderVersion = uniqueVersion();
    const newerVersion = uniqueVersion();
    expect(await publishLegalDocument(documentInput({ version: olderVersion }))).toEqual({ ok: true });
    // publishedAt settes til "nå" ved hvert kall — en liten, garantert forskjell
    // sikrer en entydig rekkefølge selv om begge kallene skjer i samme millisekund.
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(await publishLegalDocument(documentInput({ version: newerVersion }))).toEqual({ ok: true });

    const result = await listLegalDocumentsForCountry(TEST_COUNTRY_CODE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const olderIndex = result.documents.findIndex((d) => d.version === olderVersion);
    const newerIndex = result.documents.findIndex((d) => d.version === newerVersion);
    expect(olderIndex).toBeGreaterThanOrEqual(0);
    expect(newerIndex).toBeGreaterThanOrEqual(0);
    expect(newerIndex).toBeLessThan(olderIndex);
  });

  it("skiller på land — viser ALDRI et annet lands dokumenter", async () => {
    await ensureTestCountry();
    const admin = await createAdmin();
    await loginAs(admin.id);
    const otherCountryCode = "XZ";
    await db
      .insert(countries)
      .values({
        code: otherCountryCode,
        nameKey: "country.test.name",
        defaultLocale: "nb-NO",
        availableLocales: ["nb-NO"],
        timezone: "Europe/Oslo",
        minimumAge: 18,
        digestSendTime: "07:00",
        senderNameKey: "email.sender_name.test",
        supportEmail: "test@example.invalid",
        status: "draft",
      })
      .onConflictDoNothing();
    const otherVersion = uniqueVersion();
    const publishedElsewhere = await publishLegalDocument(
      documentInput({ countryCode: otherCountryCode, version: otherVersion })
    );
    expect(publishedElsewhere).toEqual({ ok: true });

    const result = await listLegalDocumentsForCountry(TEST_COUNTRY_CODE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.documents.some((d) => d.version === otherVersion)).toBe(false);
  });
});
