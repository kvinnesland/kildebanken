import type { ReactNode } from "react";
import styles from "./Card.module.css";

// DESIGN.md 6 ("Card" i minimumssettet) — en enkel, ikke-interaktiv
// beholder (ingen fokushåndtering/ARIA-rolle å arve fra en headless
// primitiv, i motsetning til f.eks. Select/Dialog). Første konkrete bruker:
// 16.1-dashbordets land-seksjoner.
export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className={styles.card}>
      {title ? <h2 className={styles.title}>{title}</h2> : null}
      {children}
    </div>
  );
}
