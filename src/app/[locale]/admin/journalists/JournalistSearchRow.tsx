"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { TextArea } from "@/components/TextArea";
import { Button } from "@/components/Button";
import styles from "./JournalistSearchRow.module.css";

interface JournalistSearchRowData {
  userId: string;
  email: string;
  status: "pending_email_verification" | "active" | "suspended" | "deleted";
  statusLabel: string;
  fullName: string;
  jobTitle: string;
  organizationName: string;
  organizationUrl: string;
  verificationStatusLabel: string;
  pastRequestsLabel: string;
}

type Mode = "view" | "suspending" | "busy" | "suspended" | "unsuspended";

const REASON_LIMIT = 2000;

export function JournalistSearchRow({
  locale,
  journalist,
}: {
  locale: SupportedLocale;
  journalist: JournalistSearchRowData;
}) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [reason, setReason] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function handleSuspend() {
    setMode("busy");
    setErrorKey(null);
    const response = await fetch(`/api/admin/users/${journalist.userId}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (response.ok) {
      setMode("suspended");
      router.refresh();
    } else {
      const data: { error?: string } = await response.json().catch(() => ({}));
      setErrorKey(data.error ?? "errors.generic");
      setMode("suspending");
    }
  }

  async function handleUnsuspend() {
    setMode("busy");
    setErrorKey(null);
    const response = await fetch(`/api/admin/users/${journalist.userId}/unsuspend`, { method: "POST" });
    if (response.ok) {
      setMode("unsuspended");
      router.refresh();
    } else {
      const data: { error?: string } = await response.json().catch(() => ({}));
      setErrorKey(data.error ?? "errors.generic");
      setMode("view");
    }
  }

  if (mode === "suspended") {
    return <li className={styles.item}>{t("admin.journalists.suspended_notice")}</li>;
  }
  if (mode === "unsuspended") {
    return <li className={styles.item}>{t("admin.journalists.unsuspended_notice")}</li>;
  }

  const canSuspend = journalist.status === "active" || journalist.status === "pending_email_verification";
  const canUnsuspend = journalist.status === "suspended";

  return (
    <li className={styles.item}>
      <div className={styles.main}>
        <span className={styles.title}>{journalist.fullName}</span>
        <span className={styles.meta}>
          {journalist.jobTitle}, {journalist.organizationName} ({journalist.organizationUrl})
        </span>
        <span className={styles.meta}>{journalist.email}</span>
        <span className={styles.meta}>
          {journalist.statusLabel} · {journalist.verificationStatusLabel} · {journalist.pastRequestsLabel}
        </span>
      </div>

      {errorKey ? <p className={styles.formError}>{t(errorKey)}</p> : null}

      {mode === "suspending" ? (
        <div className={styles.actionForm}>
          <TextArea
            label={t("admin.journalists.suspend_reason_label")}
            value={reason}
            onChange={setReason}
            maxLength={REASON_LIMIT}
            rows={3}
          />
          <div className={styles.actions}>
            <Button variant="danger" onPress={handleSuspend} isDisabled={reason.trim() === ""}>
              {t("admin.journalists.suspend_confirm_button")}
            </Button>
            <Button variant="secondary" onPress={() => setMode("view")}>
              {t("admin.journalists.suspend_cancel_button")}
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <Button
            variant="secondary"
            onPress={() => setMode("suspending")}
            isDisabled={mode === "busy" || !canSuspend}
          >
            {t("admin.journalists.suspend")}
          </Button>
          <Button variant="secondary" onPress={handleUnsuspend} isDisabled={mode === "busy" || !canUnsuspend}>
            {t("admin.journalists.unsuspend")}
          </Button>
        </div>
      )}
    </li>
  );
}
