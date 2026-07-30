import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { emailSubscriptions, suppressions, users } from "@/db/schema";
import { hashToken } from "@/lib/auth/tokens";

export type UnsubscribeResult = { ok: true } | { ok: false; error: string };

/**
 * POST /unsubscribe/:token (SPEC-V1.md 20). Ingen innlogging — ett klikk fra
 * e-postens avmeldingslenke. Tokenet roteres ved hver utsendelse (se
 * src/lib/jobs/tick.ts), så en gammel e-post sin lenke slutter automatisk å
 * virke uten at noen aktivt måtte tilbakekalle den — et ukjent/brukt token
 * behandles derfor bare som "fant ikke abonnementet", ikke som en egen
 * feilvei.
 *
 * 17.4: "Avmeldt adresse — Hashet på sperreliste, ubegrenset." Adressen
 * legges derfor til i `suppressions` her, ikke bare markert som
 * `unsubscribed` på selve abonnementet.
 */
export async function unsubscribeByToken(rawToken: string): Promise<UnsubscribeResult> {
  const tokenHash = hashToken(rawToken);

  const [row] = await db
    .select({
      subscriptionId: emailSubscriptions.id,
      status: emailSubscriptions.status,
      email: users.email,
    })
    .from(emailSubscriptions)
    .innerJoin(users, eq(emailSubscriptions.userId, users.id))
    .where(eq(emailSubscriptions.unsubscribeTokenHash, tokenHash))
    .limit(1);

  if (!row) return { ok: false, error: "errors.not_found" };

  // Idempotent — et andre klikk på samme (ennå ikke roterte) lenke er ikke
  // en feil.
  if (row.status === "unsubscribed") return { ok: true };

  await db
    .update(emailSubscriptions)
    .set({ status: "unsubscribed", unsubscribedAt: new Date() })
    .where(eq(emailSubscriptions.id, row.subscriptionId));

  await db
    .insert(suppressions)
    .values({ emailHash: hashToken(row.email), reason: "unsubscribed" })
    .onConflictDoNothing();

  return { ok: true };
}
