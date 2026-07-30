import type { ComponentPropsWithoutRef } from "react";
import {
  TextField as AriaTextField,
  Label,
  Input,
  Text,
  FieldError,
  type TextFieldProps as AriaTextFieldProps,
} from "react-aria-components";
import styles from "./TextField.module.css";

// DESIGN.md 6.1: feilmeldinger står VED FELTET (ikke bare oppsummert på
// toppen) og knyttes med aria-describedby, og feltet får aria-invalid.
// React Aria Components' <FieldError> setter aria-describedby automatisk,
// men rendrer children UBETINGET når de er en ren streng — den gater IKKE
// på gyldighet av seg selv. Derfor sjekker vi `isInvalid` eksplisitt her,
// slik at feilteksten forsvinner igjen når feltet blir gyldig.
export interface TextFieldProps extends Omit<AriaTextFieldProps, "className" | "children"> {
  label: string;
  description?: string;
  errorMessage?: string;
  inputProps?: Omit<ComponentPropsWithoutRef<typeof Input>, "className">;
}

export function TextField({ label, description, errorMessage, inputProps, ...props }: TextFieldProps) {
  return (
    <AriaTextField {...props} className={styles.field}>
      <Label className={styles.label}>{label}</Label>
      <Input {...inputProps} className={styles.input} />
      {description ? (
        <Text slot="description" className={styles.description}>
          {description}
        </Text>
      ) : null}
      <FieldError className={styles.errorMessage}>
        {({ isInvalid }) => (isInvalid ? errorMessage : null)}
      </FieldError>
    </AriaTextField>
  );
}
