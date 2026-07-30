import type { BadgeTone } from "@/components/Badge";

// DESIGN.md 6.2: "Fargetilordningen defineres ett sted og gjenbrukes i
// grensesnitt og e-post." Dekker bare de offentlig synlige statusene
// (SPEC-V1.md 11 / PUBLICLY_VISIBLE_STATUSES i requests.ts) — journalistens
// egne statuser (draft, submitted, ...) får sin egen tone-tabell den dagen
// journalistportalen faktisk viser dem.
export type PublicRequestStatus = "published" | "closed" | "expired";

const TONE_BY_STATUS: Record<PublicRequestStatus, BadgeTone> = {
  published: "success",
  closed: "neutral",
  expired: "warning",
};

// Typevakt for statusstrengen `getPublicRequest()` (requests.ts) faktisk
// returnerer — dens WHERE-klausul garanterer RUNTIME at bare disse tre
// forekommer, men Drizzle sin kolonnetype er hele enumet (ni verdier), så
// TypeScript kan ikke vite det uten denne. En kaller-side "as"-cast ville
// skjult en reell feil dersom garantien noensinne brytes; denne feiler
// tydelig i stedet.
export function isPublicRequestStatus(status: string): status is PublicRequestStatus {
  return status in TONE_BY_STATUS;
}

export function publicRequestStatusTone(status: PublicRequestStatus): BadgeTone {
  return TONE_BY_STATUS[status];
}
