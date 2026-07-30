import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { journalistProfiles, users } from "@/db/schema";

export interface JournalistProfileView {
  fullName: string;
  jobTitle: string;
  organizationName: string;
  organizationUrl: string;
  verificationStatus: "pending_review" | "approved" | "rejected";
  countryCode: string;
  locale: string;
}

// GET /journalists/me (SPEC-V1.md 20).
export async function getJournalistProfile(userId: string): Promise<JournalistProfileView | null> {
  const [row] = await db
    .select({
      fullName: journalistProfiles.fullName,
      jobTitle: journalistProfiles.jobTitle,
      organizationName: journalistProfiles.organizationName,
      organizationUrl: journalistProfiles.organizationUrl,
      verificationStatus: journalistProfiles.verificationStatus,
      countryCode: users.countryCode,
      locale: users.locale,
    })
    .from(journalistProfiles)
    .innerJoin(users, eq(journalistProfiles.userId, users.id))
    .where(eq(journalistProfiles.userId, userId))
    .limit(1);

  return row ?? null;
}

export interface UpdateJournalistProfileInput {
  fullName?: string;
  jobTitle?: string;
  organizationName?: string;
  organizationUrl?: string;
}

export type UpdateJournalistProfileResult = { ok: true } | { ok: false; error: string };

/**
 * PATCH /journalists/me (SPEC-V1.md 20, 7.2). Endrer KUN kontaktfeltene —
 * ALDRI `country_code` (7.3, siste avsnitt: journalisten kan ikke bytte land
 * selv, det krever ny moderatorvurdering) og ALDRI `verification_status`
 * (kun moderator, se src/lib/moderation/journalists.ts).
 *
 * Antagelse tatt her, spec-en sier ingenting om det (se NATTLOGG.md): en
 * redigering av disse feltene utløser IKKE ny moderatorbehandling —
 * 8.1 lister bare søknad → review som utløsende hendelse for
 * `verification_status`, ikke senere redigering av kontaktfelt på en
 * allerede vurdert profil.
 */
export async function updateJournalistProfile(
  userId: string,
  input: UpdateJournalistProfileInput
): Promise<UpdateJournalistProfileResult> {
  const updates: Partial<typeof journalistProfiles.$inferInsert> = {};

  if (input.fullName !== undefined) {
    if (!input.fullName.trim()) return { ok: false, error: "errors.validation_failed" };
    updates.fullName = input.fullName;
  }
  if (input.jobTitle !== undefined) {
    if (!input.jobTitle.trim()) return { ok: false, error: "errors.validation_failed" };
    updates.jobTitle = input.jobTitle;
  }
  if (input.organizationName !== undefined) {
    if (!input.organizationName.trim()) return { ok: false, error: "errors.validation_failed" };
    updates.organizationName = input.organizationName;
  }
  if (input.organizationUrl !== undefined) {
    if (!input.organizationUrl.trim()) return { ok: false, error: "errors.validation_failed" };
    updates.organizationUrl = input.organizationUrl;
  }

  if (Object.keys(updates).length === 0) return { ok: true };

  updates.updatedAt = new Date();

  const result = await db
    .update(journalistProfiles)
    .set(updates)
    .where(eq(journalistProfiles.userId, userId))
    .returning({ id: journalistProfiles.id });

  if (result.length === 0) return { ok: false, error: "errors.not_found" };

  return { ok: true };
}
