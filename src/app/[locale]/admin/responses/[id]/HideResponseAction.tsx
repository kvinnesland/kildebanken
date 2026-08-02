"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { Button } from "@/components/Button";
import styles from "./page.module.css";

type Mode = "view" | "confirming" | "busy" | "hidden";

// Skjul-knapp for et enkeltsvar sett fra administrasjonsgrensesnittet
// (SPEC-V1.md 12.5 — "skjule et svar" er ett av fire tiltak en moderator
// kan sette i verk etter en rapportering; her nådd via 16.2s
// begrunnelsesflyt i stedet for modereringskøen). Speiler
// ActiveRequestItem.tsx sitt bekreftelsesmønster (ett ekstra klikk) —
// hideResponse() sier selv at skjuling kansellerer ventende
// kontaktforespørsler, ikke en triviell handling å angre.
export function HideResponseAction({ locale, responseId }: { locale: SupportedLocale; responseId: string }) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function handleHide() {
    setMode("busy");
    setErrorKey(null);
    const response = await fetch(`/api/admin/responses/${responseId}/hide`, { method: "POST" });
    if (response.ok) {
      setMode("hidden");
      router.refresh();
    } else {
      const data: { error?: string } = await response.json().catch(() => ({}));
      setErrorKey(data.error ?? "errors.generic");
      setMode("confirming");
    }
  }

  if (mode === "hidden") {
    return <p className={styles.success}>{t("admin.response_detail.hidden_notice")}</p>;
  }

  return (
    <div>
      {errorKey ? <p className={styles.formError}>{t(errorKey)}</p> : null}

      {mode === "confirming" || mode === "busy" ? (
        <div className={styles.actions}>
          <Button variant="danger" onPress={handleHide} isDisabled={mode === "busy"}>
            {t("admin.response_detail.hide_confirm_button")}
          </Button>
          <Button variant="secondary" onPress={() => setMode("view")} isDisabled={mode === "busy"}>
            {t("admin.response_detail.hide_cancel_button")}
          </Button>
        </div>
      ) : (
        <div className={styles.actions}>
          <Button variant="secondary" onPress={() => setMode("confirming")}>
            {t("admin.response_detail.hide_button")}
          </Button>
        </div>
      )}
    </div>
  );
}
