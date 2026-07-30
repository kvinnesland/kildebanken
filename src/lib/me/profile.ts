import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { countries, users } from "@/db/schema";
import { isValidTimezone } from "./validate";

export interface UpdateMyProfileInput {
  displayName?: string | null;
  locale?: string;
  timezone?: string | null;
}

export type UpdateMyProfileResult = { ok: true } | { ok: false; error: string };

/**
 * PATCH /me (SPEC-V1.md 20): visningsnavn, locale, timezone. Endrer IKKE
 * `country_code` — det krever `changeCountry()` (7.3, FR-010), fordi bytte
 * av land alene krever nytt samtykke til vilkår/personvern, mens et rent
 * språkbytte for en allerede aktiv konto ikke gjør det (7.1s krav om
 * fornyet samtykke ved endret land/språk gjelder registreringsSKJEMAET, før
 * innsending — ikke løpende redigering av en ferdig konto).
 */
export async function updateMyProfile(
  userId: string,
  input: UpdateMyProfileInput
): Promise<UpdateMyProfileResult> {
  const updates: Partial<typeof users.$inferInsert> = {};

  if (input.displayName !== undefined) {
    if (input.displayName !== null && input.displayName.trim().length === 0) {
      return { ok: false, error: "errors.validation_failed" };
    }
    updates.displayName = input.displayName;
  }

  if (input.locale !== undefined) {
    const [user] = await db
      .select({ countryCode: users.countryCode })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return { ok: false, error: "errors.not_found" };

    const [country] = await db
      .select({ availableLocales: countries.availableLocales })
      .from(countries)
      .where(eq(countries.code, user.countryCode))
      .limit(1);
    if (!country || !country.availableLocales.includes(input.locale)) {
      return { ok: false, error: "errors.invalid_locale" };
    }
    updates.locale = input.locale;
  }

  if (input.timezone !== undefined) {
    if (input.timezone !== null && !isValidTimezone(input.timezone)) {
      return { ok: false, error: "errors.invalid_timezone" };
    }
    updates.timezone = input.timezone;
  }

  if (Object.keys(updates).length === 0) return { ok: true };

  updates.updatedAt = new Date();
  await db.update(users).set(updates).where(eq(users.id, userId));

  return { ok: true };
}
