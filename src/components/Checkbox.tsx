import type { ReactNode } from "react";
import { Checkbox as AriaCheckbox, type CheckboxProps as AriaCheckboxProps } from "react-aria-components";
import styles from "./Checkbox.module.css";

// SPEC-V1.md 7.1: samtykker skal ALDRI være forhåndsavkrysset. Dette er
// bevisst IKKE noe komponenten selv håndhever (den arver `defaultSelected`/
// `isSelected` fra React Aria uendret) — det er kallerens ansvar å aldri
// sette dem til `true` uten en faktisk brukerhandling. Komponenten kan ikke
// vite HVORFOR den kalles.
export interface CheckboxProps extends Omit<AriaCheckboxProps, "className" | "children"> {
  children: ReactNode;
  errorMessage?: string;
}

// Egen SVG-hake, ikke et ikonbibliotek — React Aria Components gir ingen
// visuell boks/hake selv (helt headless), og et helt nytt ikonbibliotek er
// mer enn denne ene komponenten trenger akkurat nå.
function Checkmark() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" className={styles.checkmark}>
      <path
        d="M3 8.5L6.5 12L13 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Checkbox({ children, errorMessage, isInvalid, ...props }: CheckboxProps) {
  return (
    <div>
      <AriaCheckbox {...props} isInvalid={isInvalid} className={styles.checkbox}>
        <div className={styles.box}>
          <Checkmark />
        </div>
        <span className={styles.label}>{children}</span>
      </AriaCheckbox>
      {isInvalid && errorMessage ? <span className={styles.errorMessage}>{errorMessage}</span> : null}
    </div>
  );
}
