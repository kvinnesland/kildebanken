import type { ReactNode } from "react";
import {
  RadioGroup as AriaRadioGroup,
  RadioField,
  RadioButton,
  Label,
  Text,
  FieldError,
  type RadioGroupProps as AriaRadioGroupProps,
} from "react-aria-components";
import styles from "./RadioGroup.module.css";

// DESIGN.md 6: "RadioGroup" i minimumssettet. Bruker RadioField/RadioButton
// (react-aria-components sin gjeldende, ikke-utfasede API — den eldre
// <Radio> alene er markert @deprecated i typedefinisjonen), ikke ulikt
// hvordan Checkbox.tsx bygger sin egen boks/hake — her en sirkel/prikk i
// stedet. Første konkrete bruk: SPEC-V1.md 12.2, delingsvalget for
// kontaktinformasjon i svarskjemaet (to gjensidig utelukkende alternativer,
// ikke en avkryssingsboks).
export interface RadioOption {
  value: string;
  label: ReactNode;
  description?: string;
}

export interface RadioGroupProps extends Omit<AriaRadioGroupProps, "className" | "children"> {
  label: string;
  options: readonly RadioOption[];
  errorMessage?: string;
}

export function RadioGroup({ label, options, errorMessage, ...props }: RadioGroupProps) {
  return (
    <AriaRadioGroup {...props} className={styles.group}>
      <Label className={styles.label}>{label}</Label>
      <div className={styles.options}>
        {options.map((option) => (
          <RadioField key={option.value} value={option.value} className={styles.field}>
            <RadioButton className={styles.radioButton}>
              <span className={styles.indicator} />
              <span className={styles.optionLabel}>{option.label}</span>
            </RadioButton>
            {option.description ? (
              <Text slot="description" className={styles.description}>
                {option.description}
              </Text>
            ) : null}
          </RadioField>
        ))}
      </div>
      <FieldError className={styles.errorMessage}>
        {({ isInvalid }) => (isInvalid ? errorMessage : null)}
      </FieldError>
    </AriaRadioGroup>
  );
}
