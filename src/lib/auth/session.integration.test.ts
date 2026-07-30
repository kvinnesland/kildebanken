import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { createActiveJournalist, createActiveRecipient, ensureTestCountry } from "@/db/integration/fixtures";
import { generateToken, hashToken } from "@/lib/auth/tokens";

// session.ts har `import "server-only"`, som kaster under Vitest med mindre
// "server-only" er aliaset til pakkens egen `empty.js` (se
// vitest.integration.config.ts, samme fiks som lot moderation-/admin-
// testene kjøre i det hele tatt). getCurrentSession()/revokeCurrentSession()
// leser/skriver en next/headers-cookie — mocket her med et enkelt,
// mutérbart objekt i stedet for en ekte cookie-jar, siden `createSession()`
// bruker `.set()` og de to andre bruker `.get()`/`.delete()`.
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
import { cookies } from "next/headers";

interface FakeCookieStore {
  get: (name: string) => { name: string; value: string } | undefined;
  set: (name: string, value: string, options: Record<string, unknown>) => void;
  delete: (name: string) => void;
}

function installFakeCookieJar(): { store: Map<string, string>; deleted: string[] } {
  const store = new Map<string, string>();
  const deleted: string[] = [];
  const fake: FakeCookieStore = {
    get: (name) => (store.has(name) ? { name, value: store.get(name)! } : undefined),
    set: (name, value) => store.set(name, value),
    delete: (name) => {
      store.delete(name);
      deleted.push(name);
    },
  };
  vi.mocked(cookies).mockResolvedValue(fake as unknown as Awaited<ReturnType<typeof cookies>>);
  return { store, deleted };
}

async function insertSession(
  userId: string,
  overrides: Partial<typeof sessions.$inferInsert> = {}
): Promise<string> {
  const rawToken = generateToken();
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    ...overrides,
  });
  return rawToken;
}

describe("createSession mot ekte Postgres (SPEC-V1.md 6.1/6.3)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("oppretter en øktrad og setter kb_session-cookien med samme rå token", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const { store } = installFakeCookieJar();
    const { createSession } = await import("./session");

    const result = await createSession(recipient.id, "recipient");

    expect(store.get("kb_session")).toBe(result.rawToken);
    const [row] = await db.select().from(sessions).where(eq(sessions.tokenHash, hashToken(result.rawToken)));
    expect(row?.userId).toBe(recipient.id);
    expect(row?.revokedAt).toBeNull();
  });

  it("gir mottaker/journalist 30 dagers øktlevetid", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    installFakeCookieJar();
    const { createSession } = await import("./session");

    const before = Date.now();
    const result = await createSession(recipient.id, "recipient");

    const days = (result.expiresAt.getTime() - before) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });

  it("gir moderator/administrator 12 timers øktlevetid, IKKE 30 dager (6.3: fornyes ikke)", async () => {
    await ensureTestCountry();
    const [moderator] = await db
      .insert(users)
      .values({
        email: `session-moderator-${Date.now()}@example.invalid`,
        role: "moderator",
        status: "active",
        countryCode: "XT",
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    installFakeCookieJar();
    const { createSession } = await import("./session");

    const before = Date.now();
    const result = await createSession(moderator!.id, "moderator");

    const hours = (result.expiresAt.getTime() - before) / (60 * 60 * 1000);
    expect(hours).toBeGreaterThan(11.9);
    expect(hours).toBeLessThan(12.1);
  });
});

describe("getCurrentSession mot ekte Postgres", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returnerer null når ingen kb_session-cookie finnes", async () => {
    installFakeCookieJar();
    const { getCurrentSession } = await import("./session");

    expect(await getCurrentSession()).toBeNull();
  });

  it("returnerer null for en ukjent/ugyldig token", async () => {
    const { store } = installFakeCookieJar();
    store.set("kb_session", "dette-tokenet-finnes-ikke");
    const { getCurrentSession } = await import("./session");

    expect(await getCurrentSession()).toBeNull();
  });

  it("returnerer riktig CurrentSession-form for en gyldig økt", async () => {
    await ensureTestCountry();
    const journalist = await createActiveJournalist();
    const rawToken = await insertSession(journalist.id);
    const { store } = installFakeCookieJar();
    store.set("kb_session", rawToken);
    const { getCurrentSession } = await import("./session");

    const session = await getCurrentSession();

    expect(session).not.toBeNull();
    expect(session?.userId).toBe(journalist.id);
    expect(session?.role).toBe("journalist");
    expect(session?.email).toBe(journalist.email);
  });

  it("6.1: skyver expires_at frem til ~30 dager frem OG setter last_used_at for mottaker/journalist", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const rawToken = await insertSession(recipient.id, {
      // Original utløpsdato langt unna 30 dager frem — beviser at kallet
      // faktisk SKYVER den frem, ikke bare lar den stå.
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const { store } = installFakeCookieJar();
    store.set("kb_session", rawToken);
    const { getCurrentSession } = await import("./session");

    const before = Date.now();
    await getCurrentSession();

    const [row] = await db.select().from(sessions).where(eq(sessions.tokenHash, hashToken(rawToken)));
    const days = (row!.expiresAt.getTime() - before) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
    expect(row?.lastUsedAt).not.toBeNull();
  });

  it("6.3: rører IKKE expires_at for moderator/administrator, men setter fortsatt last_used_at", async () => {
    await ensureTestCountry();
    const [moderator] = await db
      .insert(users)
      .values({
        email: `session-renew-moderator-${Date.now()}@example.invalid`,
        role: "moderator",
        status: "active",
        countryCode: "XT",
        locale: "nb-NO",
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    const originalExpiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const rawToken = await insertSession(moderator!.id, { expiresAt: originalExpiresAt });
    const { store } = installFakeCookieJar();
    store.set("kb_session", rawToken);
    const { getCurrentSession } = await import("./session");

    await getCurrentSession();

    const [row] = await db.select().from(sessions).where(eq(sessions.tokenHash, hashToken(rawToken)));
    expect(row?.expiresAt.getTime()).toBe(originalExpiresAt.getTime());
    expect(row?.lastUsedAt).not.toBeNull();
  });

  it("returnerer null for en UTLØPT økt", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const rawToken = await insertSession(recipient.id, {
      expiresAt: new Date(Date.now() - 60 * 1000),
    });
    const { store } = installFakeCookieJar();
    store.set("kb_session", rawToken);
    const { getCurrentSession } = await import("./session");

    expect(await getCurrentSession()).toBeNull();
  });

  it("returnerer null for en TILBAKEKALT økt (19.15: samme feilvei som utløpt)", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const rawToken = await insertSession(recipient.id, { revokedAt: new Date() });
    const { store } = installFakeCookieJar();
    store.set("kb_session", rawToken);
    const { getCurrentSession } = await import("./session");

    expect(await getCurrentSession()).toBeNull();
  });

  it("returnerer null når brukerens status ikke lenger er active, selv med en ellers gyldig økt", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const rawToken = await insertSession(recipient.id);
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, recipient.id));
    const { store } = installFakeCookieJar();
    store.set("kb_session", rawToken);
    const { getCurrentSession } = await import("./session");

    expect(await getCurrentSession()).toBeNull();
  });
});

describe("revokeCurrentSession mot ekte Postgres", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tilbakekaller økten i databasen OG sletter cookien", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const rawToken = await insertSession(recipient.id);
    const { store, deleted } = installFakeCookieJar();
    store.set("kb_session", rawToken);
    const { revokeCurrentSession } = await import("./session");

    await revokeCurrentSession();

    const [row] = await db.select().from(sessions).where(eq(sessions.tokenHash, hashToken(rawToken)));
    expect(row?.revokedAt).not.toBeNull();
    expect(deleted).toContain("kb_session");
  });

  it("er et trygt no-op når ingen cookie finnes", async () => {
    installFakeCookieJar();
    const { revokeCurrentSession } = await import("./session");

    await expect(revokeCurrentSession()).resolves.toBeUndefined();
  });
});

describe("revokeAllSessionsForUser mot ekte Postgres (SPEC-V1.md 17.5)", () => {
  it("tilbakekaller ALLE brukerens økter, men rører IKKE andre brukeres", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const otherRecipient = await createActiveRecipient();
    const { revokeAllSessionsForUser } = await import("./session");

    const tokenA = await insertSession(recipient.id);
    const tokenB = await insertSession(recipient.id);
    const otherToken = await insertSession(otherRecipient.id);

    await revokeAllSessionsForUser(recipient.id);

    const [rowA] = await db.select().from(sessions).where(eq(sessions.tokenHash, hashToken(tokenA)));
    const [rowB] = await db.select().from(sessions).where(eq(sessions.tokenHash, hashToken(tokenB)));
    const [otherRow] = await db.select().from(sessions).where(eq(sessions.tokenHash, hashToken(otherToken)));
    expect(rowA?.revokedAt).not.toBeNull();
    expect(rowB?.revokedAt).not.toBeNull();
    expect(otherRow?.revokedAt).toBeNull();
  });

  it("er idempotent — kalle den flere ganger feiler ikke", async () => {
    await ensureTestCountry();
    const recipient = await createActiveRecipient();
    const { revokeAllSessionsForUser } = await import("./session");
    await insertSession(recipient.id);

    await revokeAllSessionsForUser(recipient.id);
    await expect(revokeAllSessionsForUser(recipient.id)).resolves.toBeUndefined();
  });
});
