import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components";
import styles from "./Button.module.css";

// Bygget på React Aria Components (headless) — vi arver tastaturhåndtering,
// fokusfelle og ARIA, og beholder full kontroll over det visuelle (DESIGN.md
// 6). Variantsettet er DESIGN.md 6s minimumsliste: primary, secondary, ghost,
// danger.
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends Omit<AriaButtonProps, "className"> {
  variant?: ButtonVariant;
  fullWidthOnMobile?: boolean;
}

// `?? ""` fremfor en ikke-null-assertion: tsconfig sin
// `noUncheckedIndexedAccess` gjør enhver CSS-modul-egenskap `string |
// undefined` i typen (den skiller ikke mellom "denne klassen finnes ikke i
// filen" og "denne klassen finnes, men er en indeksert oppslagsverdi") —
// klassene finnes garantert i Button.module.css, men en trygg standardverdi
// er billigere enn en påstand som kunne skjult en reell skrivefeil i CSS-en.
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: styles.primary ?? "",
  secondary: styles.secondary ?? "",
  ghost: styles.ghost ?? "",
  danger: styles.danger ?? "",
};

export function Button({ variant = "primary", fullWidthOnMobile, ...props }: ButtonProps) {
  const className = [
    styles.button ?? "",
    VARIANT_CLASS[variant],
    fullWidthOnMobile ? (styles.fullWidthOnMobile ?? "") : "",
  ]
    .filter(Boolean)
    .join(" ");

  return <AriaButton {...props} className={className} />;
}
