import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

// DESIGN.md 6 ("EmptyState" i minimumssettet) + 8: "Tomme tilstander
// forklarer hva som skjer videre, ikke bare at det er tomt." Derfor et
// eget, obligatorisk `description`-felt atskilt fra `title` — komponenten
// kan ikke tvinge INNHOLDET til å faktisk forklare noe, men den kan gjøre
// det unaturlig å utelate forklaringen ved å ikke tilby en "bare tittel"-
// variant i det hele tatt.
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.emptyState}>
      <p className={styles.title}>{title}</p>
      <p className={styles.description}>{description}</p>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
