import styles from "./Button.module.css";
import type { ButtonVariant } from "./Button";

// Egen fil, UTEN import av react-aria-components: Button.tsx importerer
// "react-aria-components", som selv importerer "client-only" — et Next.js
// Server Component kan derfor ikke importere NOE fra Button.tsx i det hele
// tatt, selv en ren streng-hjelpefunksjon uten noen reell klientavhengighet,
// fordi grensen mellom server-/klientkomponenter håndheves per FIL, ikke per
// eksport. Denne funksjonen trengs av en ekte next/link-styled CTA i en
// server-rendret side (se
// src/app/[locale]/foresporsler/[id]/[slug]/page.tsx) — derfor isolert her.
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: styles.primary ?? "",
  secondary: styles.secondary ?? "",
  ghost: styles.ghost ?? "",
  danger: styles.danger ?? "",
};

export function buttonClassName(variant: ButtonVariant = "primary", fullWidthOnMobile?: boolean): string {
  return [
    styles.button ?? "",
    VARIANT_CLASS[variant],
    fullWidthOnMobile ? (styles.fullWidthOnMobile ?? "") : "",
  ]
    .filter(Boolean)
    .join(" ");
}
