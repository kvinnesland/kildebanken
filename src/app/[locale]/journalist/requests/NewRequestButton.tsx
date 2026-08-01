"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { Button } from "@/components/Button";
import styles from "./NewRequestButton.module.css";

// POST /requests (SPEC-V1.md 20, FR-010) oppretter et tomt utkast uten
// noen body — selve skjemaet fylles ut på redigeringssiden etterpå, ikke
// her. Denne knappen er derfor bare "opprett og naviger dit", ikke et
// skjema.
export function NewRequestButton({ locale }: { locale: SupportedLocale }) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function handlePress() {
    setCreating(true);
    setErrorKey(null);
    try {
      const response = await fetch("/api/requests", { method: "POST" });
      const data: { id?: string; error?: string } = await response.json();
      if (response.ok && data.id) {
        router.push(`/${locale}/journalist/requests/${data.id}`);
        return;
      }
      // Nåbart i praksis, ikke bare teoretisk — createDraft() håndhever
      // FR-020's grense på 20 utkast per journalist per døgn (SPEC-V1.md 18)
      // og gir errors.rate_limited. Uten dette feilte knappen stille (bare
      // re-aktivert, ingen forklaring) — inkonsistent med resten av
      // kodebasens etablerte mønster der enhver mislykket handling viser en
      // feilmelding.
      setErrorKey(data.error ?? "errors.generic");
    } catch {
      setErrorKey("errors.generic");
    }
    setCreating(false);
  }

  return (
    <div className={styles.wrapper}>
      <Button onPress={handlePress} isDisabled={creating}>
        {creating ? t("journalist.requests.creating") : t("journalist.requests.new_button")}
      </Button>
      {errorKey ? <p className={styles.error}>{t(errorKey)}</p> : null}
    </div>
  );
}
