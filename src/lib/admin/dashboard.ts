import { and, count, desc, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db/client";
import {
  digestDeliveries,
  digests,
  emailSubscriptions,
  journalistProfiles,
  requests,
  users,
} from "@/db/schema";
import { getAssignedCountryCodes } from "@/lib/auth/authorize";
import type { CurrentSession } from "@/lib/auth/session";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

export interface LastDigestInfo {
  scheduledFor: string;
  status: "pending" | "sending" | "sent" | "failed";
  recipientCount: number;
  failedDeliveryCount: number;
}

export interface DashboardCountryStats {
  countryCode: string;
  pendingJournalistApplications: number;
  moderationQueueCount: number;
  activeRequestsCount: number;
  expiringSoonCount: number;
  newRecipientsLast7Days: number;
  unsubscribesLast7Days: number;
  lastDigest: LastDigestInfo | null;
}

/**
 * SPEC-V1.md 16.1: de syv tallene på dashbordet, for ETT land om gangen —
 * "siste utsendelse PER LAND" i spec-teksten er selve grunnen til at dette
 * ikke er én global aggregering, se `getDashboardCountries()` under for
 * hvilke(t) land en gitt sesjon faktisk skal se.
 */
export async function getDashboardStatsForCountry(countryCode: string): Promise<DashboardCountryStats> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);
  const in48Hours = new Date(now.getTime() + FORTY_EIGHT_HOURS_MS);

  const [
    [pendingJournalistApplicationsRow],
    [moderationQueueCountRow],
    [activeRequestsCountRow],
    [expiringSoonCountRow],
    [newRecipientsLast7DaysRow],
    [unsubscribesLast7DaysRow],
    lastDigest,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(users)
      .innerJoin(journalistProfiles, eq(journalistProfiles.userId, users.id))
      .where(
        and(
          eq(users.role, "journalist"),
          eq(users.countryCode, countryCode),
          eq(journalistProfiles.verificationStatus, "pending_review")
        )
      ),
    db
      .select({ value: count() })
      .from(requests)
      .where(and(eq(requests.countryCode, countryCode), eq(requests.status, "submitted"))),
    db
      .select({ value: count() })
      .from(requests)
      .where(and(eq(requests.countryCode, countryCode), eq(requests.status, "published"))),
    db
      .select({ value: count() })
      .from(requests)
      .where(
        and(
          eq(requests.countryCode, countryCode),
          eq(requests.status, "published"),
          lt(requests.responseDeadline, in48Hours)
        )
      ),
    db
      .select({ value: count() })
      .from(users)
      .where(
        and(
          eq(users.role, "recipient"),
          eq(users.countryCode, countryCode),
          gt(users.createdAt, sevenDaysAgo)
        )
      ),
    db
      .select({ value: count() })
      .from(emailSubscriptions)
      .innerJoin(users, eq(emailSubscriptions.userId, users.id))
      .where(
        and(
          eq(users.countryCode, countryCode),
          eq(emailSubscriptions.status, "unsubscribed"),
          gt(emailSubscriptions.unsubscribedAt, sevenDaysAgo)
        )
      ),
    db
      .select({
        id: digests.id,
        scheduledFor: digests.scheduledFor,
        status: digests.status,
        recipientCount: digests.recipientCount,
      })
      .from(digests)
      .where(eq(digests.countryCode, countryCode))
      .orderBy(desc(digests.scheduledFor))
      .limit(1),
  ]);

  const pendingJournalistApplications = pendingJournalistApplicationsRow?.value ?? 0;
  const moderationQueueCount = moderationQueueCountRow?.value ?? 0;
  const activeRequestsCount = activeRequestsCountRow?.value ?? 0;
  const expiringSoonCount = expiringSoonCountRow?.value ?? 0;
  const newRecipientsLast7Days = newRecipientsLast7DaysRow?.value ?? 0;
  const unsubscribesLast7Days = unsubscribesLast7DaysRow?.value ?? 0;

  let lastDigestInfo: LastDigestInfo | null = null;
  const digestRow = lastDigest[0];
  if (digestRow) {
    const [failedDeliveryCountRow] = await db
      .select({ value: count() })
      .from(digestDeliveries)
      .where(and(eq(digestDeliveries.digestId, digestRow.id), eq(digestDeliveries.status, "failed")));
    const failedDeliveryCount = failedDeliveryCountRow?.value ?? 0;
    lastDigestInfo = {
      scheduledFor: digestRow.scheduledFor,
      status: digestRow.status,
      recipientCount: digestRow.recipientCount,
      failedDeliveryCount,
    };
  }

  return {
    countryCode,
    pendingJournalistApplications,
    moderationQueueCount,
    activeRequestsCount,
    expiringSoonCount,
    newRecipientsLast7Days,
    unsubscribesLast7Days,
    lastDigest: lastDigestInfo,
  };
}

/**
 * SPEC-V1.md 16.1: "Filtrert på moderatorens tildelte land, med landvelger
 * for administrator." En moderator får INGEN velger — dashbordet viser
 * automatisk (potensielt flere) tildelte land uten noe valg å ta. En
 * administrator velger ETT land via `selectedCountryCode` (kalleren, siden
 * side-komponenten uansett trenger listen over ALLE land for selve
 * velgeren, se `listAllCountries()`).
 */
export async function getDashboardCountries(
  session: CurrentSession,
  selectedCountryCode?: string
): Promise<string[]> {
  const assigned = await getAssignedCountryCodes(session);
  if (assigned !== "all") return assigned;
  return selectedCountryCode ? [selectedCountryCode] : [];
}
