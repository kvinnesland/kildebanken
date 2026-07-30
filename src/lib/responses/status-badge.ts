import type { BadgeTone } from "@/components/Badge";
import type { MineResponseDisplayStatus } from "./responses";

// DESIGN.md 6.2: "Fargetilordningen defineres ett sted og gjenbrukes i
// grensesnitt og e-post." Samme prinsipp som request-status-badge.ts, for
// respondentens UTLEDEDE statuser (SPEC-V1.md 12.6) i stedet for
// forespørselsstatuser.
const TONE_BY_STATUS: Record<MineResponseDisplayStatus, BadgeTone> = {
  submitted: "neutral",
  viewed: "neutral",
  contact_requested: "warning",
  not_selected: "neutral",
};

export function mineResponseStatusTone(status: MineResponseDisplayStatus): BadgeTone {
  return TONE_BY_STATUS[status];
}
