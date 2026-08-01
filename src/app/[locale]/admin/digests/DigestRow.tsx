"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { Button } from "@/components/Button";
import styles from "./DigestRow.module.css";

interface DigestRowData {
  id: string;
  rowLabel: string;
  sentCount: number;
  bouncedCount: number;
  complainedCount: number;
  failedCount: number;
}

type Mode = "view" | "busy";

export function DigestRow({ locale, digest }: { locale: SupportedLocale; digest: DigestRowData }) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleRetry() {
    setMode("busy");
    setErrorKey(null);
    setSuccessMessage(null);
    const response = await fetch(`/api/admin/digests/${digest.id}/retry`, { method: "POST" });
    const data: { error?: string; retried?: number } = await response.json().catch(() => ({}));
    if (response.ok) {
      setSuccessMessage(t("admin.digests.retry_success", { count: data.retried ?? 0 }));
      setMode("view");
      router.refresh();
    } else {
      setErrorKey(data.error ?? "errors.generic");
      setMode("view");
    }
  }

  return (
    <li className={styles.item}>
      <div className={styles.main}>
        <span className={styles.title}>{digest.rowLabel}</span>
        <dl className={styles.statGrid}>
          <div className={styles.stat}>
            <dt className={styles.statLabel}>{t("admin.digests.sent_label")}</dt>
            <dd className={styles.statValue}>{digest.sentCount}</dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.statLabel}>{t("admin.digests.bounced_label")}</dt>
            <dd className={styles.statValue}>{digest.bouncedCount}</dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.statLabel}>{t("admin.digests.complained_label")}</dt>
            <dd className={styles.statValue}>{digest.complainedCount}</dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.statLabel}>{t("admin.digests.failed_label")}</dt>
            <dd className={styles.statValue}>{digest.failedCount}</dd>
          </div>
        </dl>
      </div>

      {errorKey ? <p className={styles.formError}>{t(errorKey)}</p> : null}
      {successMessage ? <p className={styles.successNotice}>{successMessage}</p> : null}

      <div className={styles.actions}>
        <Button
          variant="secondary"
          onPress={handleRetry}
          isDisabled={mode === "busy" || digest.failedCount === 0}
        >
          {mode === "busy" ? t("admin.digests.retry_busy") : t("admin.digests.retry")}
        </Button>
      </div>
    </li>
  );
}
