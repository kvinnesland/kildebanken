"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { Button } from "@/components/Button";

// POST /requests (SPEC-V1.md 20, FR-010) oppretter et tomt utkast uten
// noen body — selve skjemaet fylles ut på redigeringssiden etterpå, ikke
// her. Denne knappen er derfor bare "opprett og naviger dit", ikke et
// skjema.
export function NewRequestButton({ locale }: { locale: SupportedLocale }) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handlePress() {
    setCreating(true);
    try {
      const response = await fetch("/api/requests", { method: "POST" });
      const data: { id?: string } = await response.json();
      if (response.ok && data.id) {
        router.push(`/${locale}/journalist/requests/${data.id}`);
        return;
      }
    } catch {
      // Faller gjennom til re-aktivert knapp under — ingen egen feilmelding
      // her, siden dette er en enkelt opprettelse uten skjemadata å miste.
    }
    setCreating(false);
  }

  return (
    <Button onPress={handlePress} isDisabled={creating}>
      {creating ? t("journalist.requests.creating") : t("journalist.requests.new_button")}
    </Button>
  );
}
