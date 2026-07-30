import type { ComponentPropsWithoutRef } from "react";
import {
  TextField as AriaTextField,
  TextArea as AriaTextArea,
  Label,
  Text,
  FieldError,
  type TextFieldProps as AriaTextFieldProps,
} from "react-aria-components";
import styles from "./TextArea.module.css";

// DESIGN.md 6: "TextArea med tegnteller" — obligatorisk for de fleste
// fritekstfeltene i SPEC-V1.md (forespørselens beskrivelse 9.1, svarskjemaet
// 12.1), som alle har en eksplisitt, håndhevet tegngrense. Telleren viser
// derfor alltid brukt/grense når `maxLength` er satt, ikke bare når feltet
// nærmer seg grensen — SPEC-en sier ingenting om å skjule den før det haster.
export interface TextAreaProps extends Omit<AriaTextFieldProps, "className" | "children"> {
  label: string;
  description?: string;
  errorMessage?: string;
  maxLength?: number;
  rows?: number;
  textareaProps?: Omit<ComponentPropsWithoutRef<typeof AriaTextArea>, "className" | "maxLength" | "rows">;
}

export function TextArea({
  label,
  description,
  errorMessage,
  maxLength,
  rows = 4,
  textareaProps,
  ...props
}: TextAreaProps) {
  // Telleren er bevisst basert på den KALLER-kontrollerte `value`-propen
  // (samme mønster som resten av skjemaene i kveld — Subscribe-/
  // JournalistApplyForm bruker alltid kontrollerte felt), ikke en egen
  // intern tilstand — unngår å duplisere sannheten om feltets innhold.
  const length = typeof props.value === "string" ? props.value.length : 0;

  return (
    <AriaTextField {...props} className={styles.field}>
      <Label className={styles.label}>{label}</Label>
      <AriaTextArea {...textareaProps} rows={rows} maxLength={maxLength} className={styles.textarea} />
      <div className={styles.footer}>
        {description ? (
          <Text slot="description" className={styles.description}>
            {description}
          </Text>
        ) : (
          <span />
        )}
        {typeof maxLength === "number" ? (
          <span className={styles.counter} aria-live="polite">
            {length}/{maxLength}
          </span>
        ) : null}
      </div>
      <FieldError className={styles.errorMessage}>
        {({ isInvalid }) => (isInvalid ? errorMessage : null)}
      </FieldError>
    </AriaTextField>
  );
}
