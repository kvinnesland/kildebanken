"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { TextArea } from "@/components/TextArea";
import { Button } from "@/components/Button";
import styles from "./RecipientRow.module.css";

interface RecipientRowData {
  id: string;
  email: string;
  status: "pending_email_verification" | "active" | "suspended" | "deleted";
  statusLabel: string;
  createdLabel: string;
  consentLines: string[];
}

type Mode = "view" | "suspending" | "confirming_delete" | "busy" | "suspended" | "deleted";

const REASON_LIMIT = 2000;

export function RecipientRow({ locale, user }: { locale: SupportedLocale; user: RecipientRowData }) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [reason, setReason] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function handleSuspend() {
    setMode("busy");
    setErrorKey(null);
    const response = await fetch(`/api/admin/users/${user.id}/suspend`, {
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

  async function handleDelete() {
    setMode("busy");
    setErrorKey(null);
    const response = await fetch(`/api/admin/users/${user.id}/delete`, { method: "POST" });
    if (response.ok) {
      setMode("deleted");
      router.refresh();
    } else {
      const data: { error?: string } = await response.json().catch(() => ({}));
      setErrorKey(data.error ?? "errors.generic");
      setMode("view");
    }
  }

  if (mode === "suspended") {
    return <li className={styles.item}>{t("admin.recipients.suspended_notice")}</li>;
  }
  if (mode === "deleted") {
    return <li className={styles.item}>{t("admin.recipients.deleted_notice")}</li>;
  }

  const canSuspend = user.status === "active" || user.status === "pending_email_verification";
  const canDelete = user.status !== "deleted";

  return (
    <li className={styles.item}>
      <div className={styles.main}>
        <span className={styles.email}>{user.email}</span>
        <span className={styles.meta}>
          {user.statusLabel} · {user.createdLabel}
        </span>
        <div className={styles.consents}>
          <span className={styles.consentsLabel}>{t("admin.recipients.consent_history_label")}</span>
          {user.consentLines.length === 0 ? (
            <span className={styles.meta}>{t("admin.recipients.no_consents")}</span>
          ) : (
            <ul className={styles.consentList}>
              {user.consentLines.map((line, index) => (
                <li key={index} className={styles.meta}>
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {errorKey ? <p className={styles.formError}>{t(errorKey)}</p> : null}

      {mode === "suspending" ? (
        <div className={styles.actionForm}>
          <TextArea
            label={t("admin.recipients.suspend_reason_label")}
            value={reason}
            onChange={setReason}
            maxLength={REASON_LIMIT}
            rows={3}
          />
          <div className={styles.actions}>
            <Button variant="danger" onPress={handleSuspend} isDisabled={reason.trim() === ""}>
              {t("admin.recipients.suspend_confirm")}
            </Button>
            <Button variant="secondary" onPress={() => setMode("view")}>
              {t("admin.recipients.suspend_cancel")}
            </Button>
          </div>
        </div>
      ) : mode === "confirming_delete" ? (
        <div className={styles.actionForm}>
          <p className={styles.formError}>{t("admin.recipients.delete_warning")}</p>
          <div className={styles.actions}>
            <Button variant="danger" onPress={handleDelete}>
              {t("admin.recipients.delete_confirm")}
            </Button>
            <Button variant="secondary" onPress={() => setMode("view")}>
              {t("admin.recipients.delete_cancel")}
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
            {t("admin.recipients.suspend")}
          </Button>
          <Button
            variant="danger"
            onPress={() => setMode("confirming_delete")}
            isDisabled={mode === "busy" || !canDelete}
          >
            {t("admin.recipients.delete")}
          </Button>
        </div>
      )}
    </li>
  );
}
