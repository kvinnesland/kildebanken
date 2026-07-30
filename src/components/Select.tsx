import {
  Select as AriaSelect,
  SelectValue,
  Label,
  Button,
  Popover,
  ListBox,
  ListBoxItem,
  FieldError,
  type SelectProps as AriaSelectProps,
  type Key,
} from "react-aria-components";
import styles from "./Select.module.css";

export interface SelectOption {
  id: string;
  label: string;
}

export interface SelectProps<T extends SelectOption>
  extends Omit<AriaSelectProps<T>, "className" | "children"> {
  label: string;
  options: readonly T[];
  errorMessage?: string;
}

function Chevron() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" className={styles.chevron}>
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// SPEC-V1.md 7.1: land og språk "vises alltid og kan endres før innsending
// ... Ingenting avgjøres stille på brukerens vegne" — komponenten selv
// forhåndsvelger IKKE et alternativ (ingen `defaultSelectedKey` satt her),
// det er kallerens ansvar akkurat som med `Checkbox`.
export function Select<T extends SelectOption>({
  label,
  options,
  errorMessage,
  ...props
}: SelectProps<T>) {
  return (
    <AriaSelect {...props} className={styles.field}>
      <Label className={styles.label}>{label}</Label>
      <Button className={styles.trigger}>
        <SelectValue />
        <Chevron />
      </Button>
      <FieldError className={styles.errorMessage}>
        {({ isInvalid }) => (isInvalid ? errorMessage : null)}
      </FieldError>
      <Popover className={styles.popover}>
        <ListBox className={styles.listbox} items={options}>
          {(option) => (
            <ListBoxItem key={option.id as Key} id={option.id} className={styles.option}>
              {option.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}
