"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { Button } from "@/components/Button";
import styles from "./ActiveRequestItem.module.css";

interface ActiveRequestItemData {
  id: string;
  title: string;
  summary: string;
  byLabel: string;
  publishedAtLabel: string;
  deadlineLabel: string;
}

type Mode = "view" | "confirming" | "busy" | "closed";

// Lukkeknapp for en publisert forespørsel, sett fra administrasjons-
// grensesnittet (SPEC-V1.md 16.2 — "lukk" er en av "Forespørsler"-
// funksjonene, POST /admin/requests/:id/close). Speiler
// journalist/requests/[id]/CloseRequestAction.tsx sitt bekreftelsesmønster
// (ett ekstra klikk, "danger"-knapp) — closeRequest() sier selv at lukking
// er irreversibelt, blant annet fordi ventende kontaktforespørsler utløper
// umiddelbart.
export function ActiveRequestItem({
  locale,
  request,
}: {
  locale: SupportedLocale;
  request: ActiveRequestItemData;
}) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function handleClose() {
    setMode("busy");
    setErrorKey(null);
    const response = await fetch(`/api/admin/requests/${request.id}/close`, { method: "POST" });
    if (response.ok) {
      setMode("closed");
      router.refresh();
    } else {
      const data: { error?: string } = await response.json().catch(() => ({}));
      setErrorKey(data.error ?? "errors.generic");
      setMode("confirming");
    }
  }

  if (mode === "closed") {
    return <li className={styles.item}>{t("admin.requests.close_success")}</li>;
  }

  return (
    <li className={styles.item}>
      <div className={styles.main}>
        <span className={styles.title}>{request.title}</span>
        <span className={styles.meta}>{request.byLabel}</span>
        <span className={styles.meta}>{request.publishedAtLabel}</span>
        {request.deadlineLabel ? <span className={styles.meta}>{request.deadlineLabel}</span> : null}
        <p className={styles.summary}>{request.summary}</p>
      </div>

      {errorKey ? <p className={styles.formError}>{t(errorKey)}</p> : null}

      {mode === "confirming" || mode === "busy" ? (
        <div className={styles.actions}>
          <Button variant="danger" onPress={handleClose} isDisabled={mode === "busy"}>
            {t("admin.requests.close_confirm_button")}
          </Button>
          <Button variant="secondary" onPress={() => setMode("view")} isDisabled={mode === "busy"}>
            {t("admin.requests.close_cancel_button")}
          </Button>
        </div>
      ) : (
        <div className={styles.actions}>
          <Button variant="secondary" onPress={() => setMode("confirming")}>
            {t("admin.requests.close_button")}
          </Button>
        </div>
      )}
    </li>
  );
}
