"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { TextArea } from "@/components/TextArea";
import { Button } from "@/components/Button";
import styles from "./JournalistQueueItem.module.css";

interface JournalistQueueItemData {
  userId: string;
  fullName: string;
  jobTitle: string;
  organizationName: string;
  organizationUrl: string;
  appliedLabel: string;
}

type Mode = "view" | "rejecting" | "busy" | "approved" | "rejected";

const REASON_LIMIT = 2000;

export function JournalistQueueItem({
  locale,
  journalist,
}: {
  locale: SupportedLocale;
  journalist: JournalistQueueItemData;
}) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [reason, setReason] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function handleApprove() {
    setMode("busy");
    setErrorKey(null);
    const response = await fetch(`/api/admin/journalists/${journalist.userId}/approve`, { method: "POST" });
    if (response.ok) {
      setMode("approved");
      router.refresh();
    } else {
      const data: { error?: string } = await response.json().catch(() => ({}));
      setErrorKey(data.error ?? "errors.generic");
      setMode("view");
    }
  }

  async function handleReject() {
    setMode("busy");
    setErrorKey(null);
    const response = await fetch(`/api/admin/journalists/${journalist.userId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (response.ok) {
      setMode("rejected");
      router.refresh();
    } else {
      const data: { error?: string } = await response.json().catch(() => ({}));
      setErrorKey(data.error ?? "errors.generic");
      setMode("rejecting");
    }
  }

  if (mode === "approved") {
    return <li className={styles.item}>{t("admin.journalists.approved_notice")}</li>;
  }
  if (mode === "rejected") {
    return <li className={styles.item}>{t("admin.journalists.rejected_notice")}</li>;
  }

  return (
    <li className={styles.item}>
      <div className={styles.main}>
        <span className={styles.name}>{journalist.fullName}</span>
        <span className={styles.meta}>
          {journalist.jobTitle} · {journalist.organizationName}
        </span>
        <span className={styles.meta}>{journalist.organizationUrl}</span>
        <span className={styles.meta}>{journalist.appliedLabel}</span>
      </div>

      {errorKey ? <p className={styles.formError}>{t(errorKey)}</p> : null}

      {mode === "rejecting" ? (
        <div className={styles.rejectForm}>
          <TextArea
            label={t("admin.journalists.reject_reason_label")}
            value={reason}
            onChange={setReason}
            maxLength={REASON_LIMIT}
            rows={3}
          />
          <div className={styles.actions}>
            <Button
              variant="danger"
              onPress={handleReject}
              isDisabled={reason.trim() === "" || (mode as Mode) === "busy"}
            >
              {t("admin.journalists.reject_confirm")}
            </Button>
            <Button variant="secondary" onPress={() => setMode("view")}>
              {t("admin.journalists.reject_cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <Button onPress={handleApprove} isDisabled={mode === "busy"}>
            {t("admin.journalists.approve")}
          </Button>
          <Button variant="danger" onPress={() => setMode("rejecting")} isDisabled={mode === "busy"}>
            {t("admin.journalists.reject")}
          </Button>
        </div>
      )}
    </li>
  );
}
