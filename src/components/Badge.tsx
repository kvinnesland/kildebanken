import type { ReactNode } from "react";
import styles from "./Badge.module.css";

// DESIGN.md 6.2: "Forespørsels- og svarstatuser vises som Badge med både
// farge og tekst. Fargetilordningen defineres ett sted og gjenbrukes i
// grensesnitt og e-post." — se src/lib/requests/status-badge.ts for selve
// status→tone-oppslaget dette komponentet er ment å brukes sammen med.
export type BadgeTone = "neutral" | "success" | "warning" | "danger";

export interface BadgeProps {
  tone: BadgeTone;
  children: ReactNode;
}

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: styles.neutral ?? "",
  success: styles.success ?? "",
  warning: styles.warning ?? "",
  danger: styles.danger ?? "",
};

export function Badge({ tone, children }: BadgeProps) {
  return <span className={`${styles.badge ?? ""} ${TONE_CLASS[tone]}`}>{children}</span>;
}
