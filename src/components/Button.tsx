import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components";
import { buttonClassName } from "./buttonClassName";

// Bygget på React Aria Components (headless) — vi arver tastaturhåndtering,
// fokusfelle og ARIA, og beholder full kontroll over det visuelle (DESIGN.md
// 6). Variantsettet er DESIGN.md 6s minimumsliste: primary, secondary, ghost,
// danger.
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends Omit<AriaButtonProps, "className"> {
  variant?: ButtonVariant;
  fullWidthOnMobile?: boolean;
}

export function Button({ variant = "primary", fullWidthOnMobile, ...props }: ButtonProps) {
  return <AriaButton {...props} className={buttonClassName(variant, fullWidthOnMobile)} />;
}
