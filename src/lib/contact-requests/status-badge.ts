import type { BadgeTone } from "@/components/Badge";

export type ContactRequestStatus = "pending" | "approved" | "declined" | "expired" | "cancelled";

const TONE_BY_STATUS: Record<ContactRequestStatus, BadgeTone> = {
  pending: "warning",
  approved: "success",
  declined: "neutral",
  expired: "neutral",
  cancelled: "neutral",
};

export function contactRequestStatusTone(status: ContactRequestStatus): BadgeTone {
  return TONE_BY_STATUS[status];
}
