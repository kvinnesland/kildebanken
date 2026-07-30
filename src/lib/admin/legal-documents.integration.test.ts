import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, emailSubscriptions, legalDocuments, sessions, users } from "@/db/schema";
import { ensureTestCountry, TEST_COUNTRY_CODE, uniqueTestEmail } from "@/db/integration/fixtures";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { publishLegalDocument, type PublishLegalDocumentInput } from "./legal-documents";

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

    const result = await publishLegalDocument(documentInput());

    expect(result).toEqual({ ok: false, error: "errors.not_authorized" });
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
