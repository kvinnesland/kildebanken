"use client";

import { useState } from "react";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { TextField } from "@/components/TextField";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import styles from "./forms.module.css";

type VerificationStatus = "pending_review" | "approved" | "rejected";

const TONE_BY_STATUS: Record<VerificationStatus, "neutral" | "success" | "danger"> = {
  pending_review: "neutral",
  approved: "success",
  rejected: "danger",
};

export function JournalistProfileForm({
  locale,
  verificationStatus,
  initial,
}: {
  locale: SupportedLocale;
  verificationStatus: VerificationStatus;
  initial: {
    fullName: string;
    jobTitle: string;
    organizationName: string;
    organizationUrl: string;
  };
}) {
  const t = createTranslator(locale);

  const [fullName, setFullName] = useState(initial.fullName);
  const [jobTitle, setJobTitle] = useState(initial.jobTitle);
  const [organizationName, setOrganizationName] = useState(initial.organizationName);
  const [organizationUrl, setOrganizationUrl] = useState(initial.organizationUrl);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function handleSave() {
    setStatus("saving");
    setErrorKey(null);
    try {
      const response = await fetch("/api/journalists/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, jobTitle, organizationName, organizationUrl }),
      });
      const data: { error?: string } = await response.json();
      if (!response.ok) {
        setStatus("error");
        setErrorKey(data.error ?? "errors.generic");
        return;
      }
      setStatus("saved");
    } catch {
      setStatus("error");
      setErrorKey("errors.generic");
    }
  }

  return (
    <div className={styles.form}>
      <div className={styles.statusRow}>
        <span>{t("me.verification_status_label")}:</span>
        <Badge tone={TONE_BY_STATUS[verificationStatus]}>
          {t(`me.verification_status.${verificationStatus}`)}
        </Badge>
      </div>

      {errorKey ? <p className={styles.error}>{t(errorKey)}</p> : null}
      {status === "saved" ? <p className={styles.success}>{t("me.saved_notice")}</p> : null}

      <TextField
        label={t("journalist.apply.full_name_label")}
        value={fullName}
        onChange={setFullName}
        isRequired
        inputProps={{ maxLength: 200 }}
      />
      <TextField
        label={t("journalist.apply.job_title_label")}
        value={jobTitle}
        onChange={setJobTitle}
        isRequired
        inputProps={{ maxLength: 200 }}
      />
      <TextField
        label={t("journalist.apply.organization_name_label")}
        value={organizationName}
        onChange={setOrganizationName}
        isRequired
        inputProps={{ maxLength: 200 }}
      />
      <TextField
        label={t("journalist.apply.organization_url_label")}
        value={organizationUrl}
        onChange={setOrganizationUrl}
        isRequired
        inputProps={{ type: "url" }}
      />
      <Button onPress={handleSave} isDisabled={status === "saving"}>
        {t("me.save")}
      </Button>
    </div>
  );
}
