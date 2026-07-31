import type { RefObject } from "react";

// DESIGN.md 6.1: "Skjemaer med feil flytter fokus til første feilende felt."
// Kalles rett etter et mislykket valideringsforsøk (klient- eller
// server-side). React Aria Components setter aria-invalid på selve det
// fokuserbare elementet (input/knapp/radio) når isInvalid er sant, så et
// enkelt DOM-søk finner riktig mål uten at hvert skjema trenger egne refs
// per felt. requestAnimationFrame venter til React har committet de nye
// aria-invalid-attributtene og nettleseren har tegnet dem, før vi søker.
export function focusFirstInvalidField(formRef: RefObject<HTMLFormElement | null>) {
  requestAnimationFrame(() => {
    const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    field?.focus();
  });
}
