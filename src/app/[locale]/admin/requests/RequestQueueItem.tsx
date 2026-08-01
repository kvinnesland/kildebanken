"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { TextArea } from "@/components/TextArea";
import { Button } from "@/components/Button";
import styles from "./RequestQueueItem.module.css";

interface RequestQueueItemData {
  id: string;
  title: string;
  summary: string;
  description: string;
  targetPersonDescription: string;
  byLabel: string;
  deadlineLabel: string;
}

type Mode = "view" | "rejecting" | "requesting_changes" | "busy" | "published" | "rejected" | "changes_requested";

const REASON_LIMIT = 2000;

export function RequestQueueItem({
  locale,
  request,
}: {
  locale: SupportedLocale;
  request: RequestQueueItemData;
}) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [text, setText] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function handlePublish() {
    setMode("busy");
    setErrorKey(null);
    const response = await fetch(`/api/admin/requests/${request.id}/publish`, { method: "POST" });
    if (response.ok) {
      setMode("published");
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
    const response = await fetch(`/api/admin/requests/${request.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: text }),
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

  async function handleRequestChanges() {
    setMode("busy");
    setErrorKey(null);
    const response = await fetch(`/api/admin/requests/${request.id}/request-changes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: text }),
    });
    if (response.ok) {
      setMode("changes_requested");
      router.refresh();
    } else {
      const data: { error?: string } = await response.json().catch(() => ({}));
      setErrorKey(data.error ?? "errors.generic");
      setMode("requesting_changes");
    }
  }

  if (mode === "published") {
    return <li className={styles.item}>{t("admin.requests.published_notice")}</li>;
  }
  if (mode === "rejected") {
    return <li className={styles.item}>{t("admin.requests.rejected_notice")}</li>;
  }
  if (mode === "changes_requested") {
    return <li className={styles.item}>{t("admin.requests.changes_requested_notice")}</li>;
  }

  return (
    <li className={styles.item}>
      <div className={styles.main}>
        <span className={styles.title}>{request.title}</span>
        <span className={styles.meta}>{request.byLabel}</span>
        {request.deadlineLabel ? <span className={styles.meta}>{request.deadlineLabel}</span> : null}
        <p className={styles.summary}>{request.summary}</p>
        <p className={styles.description}>{request.description}</p>
        <p className={styles.meta}>{request.targetPersonDescription}</p>
      </div>

      {errorKey ? <p className={styles.formError}>{t(errorKey)}</p> : null}

      {mode === "rejecting" || mode === "requesting_changes" ? (
        <div className={styles.textForm}>
          <TextArea
            label={
              mode === "rejecting"
                ? t("admin.requests.reject_reason_label")
                : t("admin.requests.request_changes_comment_label")
            }
            value={text}
            onChange={setText}
            maxLength={REASON_LIMIT}
            rows={3}
          />
          <div className={styles.actions}>
            <Button
              variant="danger"
              onPress={mode === "rejecting" ? handleReject : handleRequestChanges}
              isDisabled={text.trim() === ""}
            >
              {t("admin.requests.confirm")}
            </Button>
            <Button variant="secondary" onPress={() => setMode("view")}>
              {t("admin.requests.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <Button onPress={handlePublish} isDisabled={mode === "busy"}>
            {t("admin.requests.publish")}
          </Button>
          <Button variant="secondary" onPress={() => setMode("requesting_changes")} isDisabled={mode === "busy"}>
            {t("admin.requests.request_changes")}
          </Button>
          <Button variant="danger" onPress={() => setMode("rejecting")} isDisabled={mode === "busy"}>
            {t("admin.requests.reject")}
          </Button>
        </div>
      )}
    </li>
  );
}
