"use client";

import { useState } from "react";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { Button } from "@/components/Button";
import styles from "./forms.module.css";

export function DeleteAccountSection({ locale }: { locale: SupportedLocale }) {
  const t = createTranslator(locale);
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleRequest() {
    setBusy(true);
    await fetch("/api/me/request-deletion", { method: "POST" });
    setRequested(true);
    setBusy(false);
  }

  return (
    <div className={styles.dangerZone}>
      <h2 className={styles.dangerTitle}>{t("me.delete_account_title")}</h2>
      {requested ? (
        <p className={styles.success}>{t("me.delete_account_requested_notice")}</p>
      ) : (
        <>
          <p className={styles.description}>{t("me.delete_account_description")}</p>
          <Button variant="danger" onPress={handleRequest} isDisabled={busy}>
            {t("me.delete_account_button")}
          </Button>
        </>
      )}
    </div>
  );
}
