"use client";

import { useRef, useState, type FormEvent } from "react";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { TextField } from "@/components/TextField";
import { TextArea } from "@/components/TextArea";
import { Button } from "@/components/Button";
import { focusFirstInvalidField } from "@/lib/forms/focus-first-invalid";
import styles from "./ReportForm.module.css";

type Status = "collapsed" | "expanded" | "submitting" | "success" | "error";

// SPEC-V1.md 12.5: "Både forespørsler og svar kan rapporteres via et enkelt
// skjema" — samme komponent brukes for begge (entityType skiller dem), ingen
// egen datamodell (25, punkt 10: sender bare e-post til landets moderatorer).
// Bevisst en inline utvidbar seksjon, ikke en Dialog — Dialog-komponenten
// finnes ikke ennå (DESIGN.md 6), og en modal er ikke nødvendig for et så
// lite skjema (DESIGN.md 5: ingen handling skal være umulig på mobil, og en
// full-skjerm-modal legger til kompleksitet uten å løse noe her).
export function ReportForm({
  locale,
  entityType,
  entityId,
}: {
  locale: SupportedLocale;
  entityType: "request" | "response";
  entityId: string;
}) {
  const t = createTranslator(locale);
  const [status, setStatus] = useState<Status>("collapsed");
  const [attempted, setAttempted] = useState(false);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  if (status === "success") {
    return <p className={styles.success}>{t("report.success")}</p>;
  }

  if (status === "collapsed") {
    return (
      <Button variant="ghost" onPress={() => setStatus("expanded")}>
        {entityType === "request" ? t("request.report_button") : t("response.report_button")}
      </Button>
    );
  }

  const reasonValid = reason.trim() !== "" && reason.length <= 200;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (!reasonValid) {
      focusFirstInvalidField(formRef);
      return;
    }

    setStatus("submitting");
    setErrorKey(null);
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          reason,
          comment: comment.trim() ? comment.trim() : undefined,
        }),
      });
      const data: { error?: string } = await response.json();
      if (!response.ok) {
        setStatus("error");
        setErrorKey(data.error ?? "errors.generic");
        return;
      }
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorKey("errors.generic");
    }
  }

  return (
    <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate>
      {errorKey ? <p className={styles.formError}>{t(errorKey)}</p> : null}

      <TextField
        label={t("report.reason_label")}
        value={reason}
        onChange={setReason}
        isRequired
        isInvalid={attempted && !reasonValid}
        errorMessage={t("errors.reason_required")}
        inputProps={{ maxLength: 200 }}
      />

      <TextArea
        label={t("report.comment_label")}
        value={comment}
        onChange={setComment}
        maxLength={1000}
      />

      <div className={styles.actions}>
        <Button type="submit" isDisabled={status === "submitting"}>
          {status === "submitting" ? t("report.submitting") : t("report.submit")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onPress={() => setStatus("collapsed")}
          isDisabled={status === "submitting"}
        >
          {t("report.cancel")}
        </Button>
      </div>
    </form>
  );
}
