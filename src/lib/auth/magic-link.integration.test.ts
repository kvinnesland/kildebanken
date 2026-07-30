import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { authTokens, users } from "@/db/schema";
import {
  createActiveJournalist,
  createActiveRecipient,
  ensureTestCountry,
  TEST_COUNTRY_CODE,
  uniqueTestEmail,
} from "@/db/integration/fixtures";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { requestMagicLink, verifyMagicLink } from "./magic-link";

// Ingen sesjon/cookie-avhengighet i det hele tatt — hverken
// requestMagicLink() eller verifyMagicLink() bruker next/headers, så INGEN
// vi.mock() trengs her (samme kategori som tick.ts/account-deletion.ts).

async function countTokensFor(userId: string): Promise<number> {
  const rows = await db.select().from(authTokens).where(eq(authTokens.userId, userId));
  return rows.length;
}

describe("requestMagicLink mot ekte Postgres (SPEC-V1.md 6.1)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("gjør INGENTING for en e-postadresse som ikke finnes (avslører den ikke)", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await requestMagicLink(uniqueTestEmail("does-not-exist"));

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("gjør ingenting for en suspendert bruker", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const recipient = await createActiveRecipient();
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, recipient.id));

    await requestMagicLink(recipient.email);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(await countTokensFor(recipient.id)).toBe(0);
  });

  it("gjør ingenting for en slettet bruker", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const recipient = await createActiveRecipient();
    await db.update(users).set({ status: "deleted" }).where(eq(users.id, recipient.id));

    await requestMagicLink(recipient.email);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(await countTokensFor(recipient.id)).toBe(0);
  });

  it("oppretter et login-token og sender magic_link for en allerede bekreftet bruker", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const recipient = await createActiveRecipient();

    await requestMagicLink(recipient.email);

    const [token] = await db.select().from(authTokens).where(eq(authTokens.userId, recipient.id));
    expect(token?.purpose).toBe("login");
    expect(token?.usedAt).toBeNull();
    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes("magic_link"))).toBe(true);
  });

  it("sender confirm_email (ikke magic_link) for en mottaker som ennå ikke er bekreftet", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const email = uniqueTestEmail("unverified-recipient");
    const [user] = await db
      .insert(users)
      .values({
        email,
        role: "recipient",
        status: "pending_email_verification",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
      })
      .returning({ id: users.id });

    await requestMagicLink(email);

    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes("confirm_email"))).toBe(true);
    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes("magic_link"))).toBe(false);
    await db.delete(authTokens).where(eq(authTokens.userId, user!.id));
  });

  it("sender journalist_application_received (ikke magic_link) for en journalist som ennå ikke er bekreftet", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const email = uniqueTestEmail("unverified-journalist");
    const [user] = await db
      .insert(users)
      .values({
        email,
        role: "journalist",
        status: "pending_email_verification",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
      })
      .returning({ id: users.id });

    await requestMagicLink(email);

    expect(
      warnSpy.mock.calls.some((call) => String(call[0]).includes("journalist_application_received"))
    ).toBe(true);
    await db.delete(authTokens).where(eq(authTokens.userId, user!.id));
  });

  it("respekterer FR-nevnt hastighetsgrense — nekter en sjette forespørsel innen 15 minutter", async () => {
    await ensureTestCountry();
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const recipient = await createActiveRecipient();

    for (let i = 0; i < 5; i++) {
      await requestMagicLink(recipient.email);
    }
    expect(await countTokensFor(recipient.id)).toBe(5);
    warnSpy.mockClear();

    await requestMagicLink(recipient.email);

    expect(await countTokensFor(recipient.id)).toBe(5);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("verifyMagicLink mot ekte Postgres", () => {
  it("avviser et ikke-eksisterende token", async () => {
    const result = await verifyMagicLink("dette-tokenet-finnes-ikke");
    expect(result).toBeNull();
  });

  it("avviser et token med feil formål (delete_account brukt på login-endepunktet)", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const rawToken = generateToken();
    await db.insert(authTokens).values({
      userId: recipient.id,
      tokenHash: hashToken(rawToken),
      purpose: "delete_account",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const result = await verifyMagicLink(rawToken);

    expect(result).toBeNull();
  });

  it("avviser et allerede brukt token", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const rawToken = generateToken();
    await db.insert(authTokens).values({
      userId: recipient.id,
      tokenHash: hashToken(rawToken),
      purpose: "login",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      usedAt: new Date(),
    });

    const result = await verifyMagicLink(rawToken);

    expect(result).toBeNull();
  });

  it("avviser et utløpt token", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const rawToken = generateToken();
    await db.insert(authTokens).values({
      userId: recipient.id,
      tokenHash: hashToken(rawToken),
      purpose: "login",
      expiresAt: new Date(Date.now() - 60 * 1000),
    });

    const result = await verifyMagicLink(rawToken);

    expect(result).toBeNull();
  });

  it("avviser et gyldig token for en suspendert bruker", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, recipient.id));
    const rawToken = generateToken();
    await db.insert(authTokens).values({
      userId: recipient.id,
      tokenHash: hashToken(rawToken),
      purpose: "login",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const result = await verifyMagicLink(rawToken);

    expect(result).toBeNull();
  });

  it("verifiserer et gyldig login-token, markerer det brukt, og bekrefter en ubekreftet konto", async () => {
    await ensureTestCountry();
    const email = uniqueTestEmail("to-be-verified");
    const [user] = await db
      .insert(users)
      .values({
        email,
        role: "recipient",
        status: "pending_email_verification",
        countryCode: TEST_COUNTRY_CODE,
        locale: "nb-NO",
      })
      .returning({ id: users.id });
    const rawToken = generateToken();
    await db.insert(authTokens).values({
      userId: user!.id,
      tokenHash: hashToken(rawToken),
      purpose: "login",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const result = await verifyMagicLink(rawToken);

    expect(result).toEqual({ userId: user!.id, role: "recipient", locale: "nb-NO" });

    const [afterUser] = await db.select().from(users).where(eq(users.id, user!.id));
    expect(afterUser?.status).toBe("active");
    expect(afterUser?.emailVerifiedAt).not.toBeNull();

    const [afterToken] = await db.select().from(authTokens).where(eq(authTokens.tokenHash, hashToken(rawToken)));
    expect(afterToken?.usedAt).not.toBeNull();
  });

  it("samme token kan ikke brukes to ganger", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const rawToken = generateToken();
    await db.insert(authTokens).values({
      userId: recipient.id,
      tokenHash: hashToken(rawToken),
      purpose: "login",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const first = await verifyMagicLink(rawToken);
    const second = await verifyMagicLink(rawToken);

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("rører IKKE emailVerifiedAt for en allerede bekreftet, aktiv bruker", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const [before] = await db.select().from(users).where(eq(users.id, journalist.id));
    const rawToken = generateToken();
    await db.insert(authTokens).values({
      userId: journalist.id,
      tokenHash: hashToken(rawToken),
      purpose: "login",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const result = await verifyMagicLink(rawToken);

    expect(result).toEqual({ userId: journalist.id, role: "journalist", locale: "nb-NO" });
    const [after] = await db.select().from(users).where(eq(users.id, journalist.id));
    expect(after?.emailVerifiedAt?.getTime()).toBe(before?.emailVerifiedAt?.getTime());
    expect(after?.status).toBe("active");
  });
});
