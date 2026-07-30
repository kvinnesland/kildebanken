"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { Button } from "@/components/Button";
import styles from "./page.module.css";

type Status = "idle" | "confirming" | "busy" | "closed" | "error";

// Lukkeknapp for en publisert forespørsel (SPEC-V1.md 9.2, 20 — POST
// /requests/:id/close). Krever ett ekstra klikk for å bekrefte, siden
// lukking er irreversibelt (fører bl.a. til at ventende
// kontaktforespørsler utløper umiddelbart, se closeRequest()).
export function CloseRequestAction({
  locale,
  requestId,
}: {
  locale: SupportedLocale;
  requestId: string;
}) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");

  async function close() {
    setStatus("busy");
    const response = await fetch(`/api/requests/${requestId}/close`, { method: "POST" });
    if (response.ok) {
      setStatus("closed");
      router.refresh();
    } else {
      setStatus("error");
    }
  }

  if (status === "closed") {
    return <p className={styles.notice}>{t("journalist.requests.close_success")}</p>;
  }

  if (status === "confirming" || status === "busy" || status === "error") {
    return (
      <div className={styles.actions}>
        <Button variant="danger" onPress={close} isDisabled={status === "busy"}>
          {t("journalist.requests.close_confirm_button")}
        </Button>
        <Button
          variant="ghost"
          onPress={() => setStatus("idle")}
          isDisabled={status === "busy"}
        >
          {t("journalist.requests.close_cancel_button")}
        </Button>
        {status === "error" ? (
          <p className={styles.comment}>{t("journalist.requests.close_error")}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.actions}>
      <Button variant="secondary" onPress={() => setStatus("confirming")}>
        {t("journalist.requests.close_button")}
      </Button>
    </div>
  );
}
