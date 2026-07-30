"use client";

import { useState, type FormEvent } from "react";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { TextField } from "@/components/TextField";
import { TextArea } from "@/components/TextArea";
import { RadioGroup } from "@/components/RadioGroup";
import { Button } from "@/components/Button";
import styles from "./ResponseForm.module.css";

const LIMITS = {
  relevanceStatement: 2000,
  answerText: 4000,
  shortBio: 500,
  displayName: 80,
} as const;

type Step = "form" | "confirm" | "submitting" | "success" | "error";
type ContactSharing = "none" | "email";

export function ResponseForm({
  locale,
  requestId,
  journalistName,
  organizationName,
  sessionEmail,
}: {
  locale: SupportedLocale;
  requestId: string;
  journalistName: string;
  organizationName: string;
  sessionEmail: string;
}) {
  const t = createTranslator(locale);

  const [step, setStep] = useState<Step>("form");
  const [attempted, setAttempted] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [relevanceStatement, setRelevanceStatement] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [shortBio, setShortBio] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [contactSharing, setContactSharing] = useState<ContactSharing>("none");

  const relevanceValid =
    relevanceStatement.trim() !== "" && relevanceStatement.length <= LIMITS.relevanceStatement;
  const answerValid = answerText.trim() !== "" && answerText.length <= LIMITS.answerText;
  const shortBioValid = shortBio.length <= LIMITS.shortBio;
  const displayNameValid = displayName.length <= LIMITS.displayName;
  const formValid = relevanceValid && answerValid && shortBioValid && displayNameValid;

  function handleContinue(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (!formValid) return;
    setStep("confirm");
  }

  async function handleConfirm() {
    setStep("submitting");
    setErrorKey(null);
    try {
      const response = await fetch(`/api/requests/${requestId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relevanceStatement,
          answerText,
          shortBio: shortBio.trim() ? shortBio.trim() : undefined,
          displayName: displayName.trim() ? displayName.trim() : undefined,
          contactSharing,
        }),
      });
      const data: { error?: string } = await response.json();
      if (!response.ok) {
        setStep("error");
        setErrorKey(data.error ?? "errors.generic");
        return;
      }
      setStep("success");
    } catch {
      setStep("error");
      setErrorKey("errors.generic");
    }
  }

  if (step === "success") {
    return <p className={styles.success}>{t("response.success")}</p>;
  }

  if (step === "confirm" || step === "submitting" || step === "error") {
    return (
      <div className={styles.confirm}>
        <h2 className={styles.confirmTitle}>{t("response.confirm.title")}</h2>
        {errorKey ? <p className={styles.formError}>{t(errorKey)}</p> : null}
        <ul className={styles.confirmList}>
          <li>{t("response.form.confirm_journalist", { journalistName, organizationName })}</li>
          <li>
            {contactSharing === "email"
              ? t("response.confirm.sharing_email", { email: sessionEmail })
              : t("response.confirm.sharing_none")}
          </li>
          <li>{t("response.confirm.may_be_quoted")}</li>
          <li>{t("response.form.confirm_no_guarantee")}</li>
          <li>{t("response.confirm.journalist_responsibility")}</li>
          <li>{t("response.confirm.platform_verification")}</li>
          <li>{t("response.confirm.no_withdrawal_from_journalist")}</li>
        </ul>
        <div className={styles.actions}>
          <Button onPress={handleConfirm} isDisabled={step === "submitting"}>
            {t("response.confirm.submit")}
          </Button>
          <Button variant="secondary" onPress={() => setStep("form")} isDisabled={step === "submitting"}>
            {t("response.confirm.back")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleContinue} noValidate>
      <TextArea
        label={t("response.form.relevance_label")}
        value={relevanceStatement}
        onChange={setRelevanceStatement}
        maxLength={LIMITS.relevanceStatement}
        isRequired
        isInvalid={attempted && !relevanceValid}
        errorMessage={t("errors.field_required")}
        rows={4}
      />
      <TextArea
        label={t("response.form.answer_label")}
        value={answerText}
        onChange={setAnswerText}
        maxLength={LIMITS.answerText}
        isRequired
        isInvalid={attempted && !answerValid}
        errorMessage={t("errors.field_required")}
        rows={6}
      />
      <TextArea
        label={t("response.form.short_bio_label")}
        value={shortBio}
        onChange={setShortBio}
        maxLength={LIMITS.shortBio}
        rows={3}
      />
      <TextField
        label={t("response.form.display_name_label")}
        value={displayName}
        onChange={setDisplayName}
        inputProps={{ maxLength: LIMITS.displayName }}
      />
      <RadioGroup
        label={t("response.form.contact_sharing_label")}
        value={contactSharing}
        onChange={(value) => setContactSharing(value as ContactSharing)}
        options={[
          { value: "none", label: t("response.form.contact_sharing_none") },
          { value: "email", label: t("response.form.contact_sharing_email") },
        ]}
      />
      <Button type="submit">{t("response.form.next")}</Button>
    </form>
  );
}
