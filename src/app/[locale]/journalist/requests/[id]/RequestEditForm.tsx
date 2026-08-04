"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { FIELD_LIMITS, type SubmitValidationError } from "@/lib/requests/validate";
import { REQUEST_TOPICS } from "@/lib/requests/topics";
import { TextField } from "@/components/TextField";
import { TextArea } from "@/components/TextArea";
import { Select, type SelectOption } from "@/components/Select";
import { RadioGroup } from "@/components/RadioGroup";
import { Button } from "@/components/Button";
import { focusFirstInvalidField } from "@/lib/forms/focus-first-invalid";
import styles from "./RequestEditForm.module.css";

// De fire FR-021-feltene importeres fra FIELD_LIMITS i stedet for en egen,
// duplisert kopi (reelt hull frem til nå, se NATTLOGG.md) — samme bugklasse
// som task #57/#59/#126/#127. `geographicNote`/`internalReference` er IKKE
// del av FIELD_LIMITS (de er valgfrie felt validert direkte i selve
// API-rutens Zod-skjema, ikke i validateForSubmit()), derfor fortsatt
// lokale her.
const LIMITS = {
  ...FIELD_LIMITS,
  geographicNote: 100,
  internalReference: 100,
} as const;

const NO_TOPIC = "none";

type YesNo = "yes" | "no";

function toYesNo(value: boolean | null): YesNo | undefined {
  if (value === null) return undefined;
  return value ? "yes" : "no";
}

function fromYesNo(value: string): boolean {
  return value === "yes";
}

interface RequestFormValues {
  title: string;
  summary: string;
  description: string;
  targetPersonDescription: string;
  topic: string | null;
  geographicNote: string;
  internalReference: string;
  contentLanguage: string;
  responseDeadlineLocal: string;
  allowsAnonymousParticipation: boolean | null;
  mayBeRecorded: boolean | null;
  mayInvolvePhotoVideo: boolean | null;
}

type Phase = "idle" | "saving" | "saved" | "submitting" | "submitted" | "error";

function errorFor(
  fieldErrors: SubmitValidationError[],
  codes: readonly SubmitValidationError[]
): SubmitValidationError | undefined {
  return fieldErrors.find((code) => codes.includes(code));
}

export function RequestEditForm({
  locale,
  requestId,
  availableLocales,
  timezone,
  initial,
}: {
  locale: SupportedLocale;
  requestId: string;
  availableLocales: string[];
  timezone: string;
  initial: RequestFormValues;
}) {
  const t = createTranslator(locale);

  const [values, setValues] = useState(initial);
  const [phase, setPhase] = useState<Phase>("idle");
  const [fieldErrors, setFieldErrors] = useState<SubmitValidationError[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);
  // SPEC-V1.md 9.2 (FR-029): en avvist innsending pga. samtidighetsgrensen
  // skal "liste hvilke forespørsler journalisten må lukke først", ikke bare
  // forklare AT grensen er nådd — se submitRequest() i requests.ts.
  const [blockingRequests, setBlockingRequests] = useState<{ id: string; title: string }[]>([]);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const topicOptions: SelectOption[] = [
    { id: NO_TOPIC, label: t("journalist.request_form.topic_placeholder") },
    ...REQUEST_TOPICS.map((topic) => ({ id: topic, label: t(`request.topic.${topic}`) })),
  ];
  const languageOptions: SelectOption[] = availableLocales.map((code) => ({
    id: code,
    label: t(`locale.name.${code}`),
  }));

  function set<K extends keyof RequestFormValues>(key: K, value: RequestFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function buildPatchBody() {
    return {
      title: values.title,
      summary: values.summary,
      description: values.description,
      targetPersonDescription: values.targetPersonDescription,
      topic: values.topic && values.topic !== NO_TOPIC ? values.topic : null,
      geographicNote: values.geographicNote.trim() ? values.geographicNote.trim() : null,
      internalReference: values.internalReference.trim() ? values.internalReference.trim() : null,
      contentLanguage: values.contentLanguage,
      ...(values.responseDeadlineLocal ? { responseDeadlineLocal: values.responseDeadlineLocal } : {}),
      ...(values.allowsAnonymousParticipation !== null
        ? { allowsAnonymousParticipation: values.allowsAnonymousParticipation }
        : {}),
      ...(values.mayBeRecorded !== null ? { mayBeRecorded: values.mayBeRecorded } : {}),
      ...(values.mayInvolvePhotoVideo !== null
        ? { mayInvolvePhotoVideo: values.mayInvolvePhotoVideo }
        : {}),
    };
  }

  async function handleSave() {
    setPhase("saving");
    setGeneralError(null);
    setFieldErrors([]);
    setBlockingRequests([]);
    try {
      const response = await fetch(`/api/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPatchBody()),
      });
      const data: { error?: string; fieldErrors?: SubmitValidationError[] } = await response.json();
      if (!response.ok) {
        setPhase("error");
        setGeneralError(data.error ?? "errors.generic");
        setFieldErrors(data.fieldErrors ?? []);
        focusFirstInvalidField(formRef);
        return;
      }
      setPhase("saved");
      router.refresh();
    } catch {
      setPhase("error");
      setGeneralError("errors.generic");
    }
  }

  async function handleSubmit() {
    setPhase("submitting");
    setGeneralError(null);
    setFieldErrors([]);
    setBlockingRequests([]);
    try {
      const saveResponse = await fetch(`/api/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPatchBody()),
      });
      const saveData: { error?: string; fieldErrors?: SubmitValidationError[] } = await saveResponse.json();
      if (!saveResponse.ok) {
        setPhase("error");
        setGeneralError(saveData.error ?? "errors.generic");
        setFieldErrors(saveData.fieldErrors ?? []);
        focusFirstInvalidField(formRef);
        return;
      }

      const submitResponse = await fetch(`/api/requests/${requestId}/submit`, { method: "POST" });
      const submitData: {
        error?: string;
        fieldErrors?: SubmitValidationError[];
        blockingRequests?: { id: string; title: string }[];
      } = await submitResponse.json();
      if (!submitResponse.ok) {
        setPhase("error");
        setGeneralError(submitData.error ?? "errors.generic");
        setFieldErrors(submitData.fieldErrors ?? []);
        setBlockingRequests(submitData.blockingRequests ?? []);
        focusFirstInvalidField(formRef);
        return;
      }
      setPhase("submitted");
      router.refresh();
    } catch {
      setPhase("error");
      setGeneralError("errors.generic");
    }
  }

  const titleError = errorFor(fieldErrors, ["title_required", "title_too_long"]);
  const summaryError = errorFor(fieldErrors, ["summary_required", "summary_too_long"]);
  const descriptionError = errorFor(fieldErrors, ["description_required", "description_too_long"]);
  const targetPersonError = errorFor(fieldErrors, [
    "target_person_description_required",
    "target_person_description_too_long",
  ]);
  const deadlineError = errorFor(fieldErrors, [
    "response_deadline_required",
    "response_deadline_too_soon",
    "response_deadline_too_far",
  ]);
  const anonymousError = errorFor(fieldErrors, ["allows_anonymous_participation_required"]);
  const recordedError = errorFor(fieldErrors, ["may_be_recorded_required"]);
  const photoVideoError = errorFor(fieldErrors, ["may_involve_photo_video_required"]);

  const busy = phase === "saving" || phase === "submitting";

  return (
    <form ref={formRef} className={styles.form} onSubmit={(event) => event.preventDefault()} noValidate>
      {generalError ? (
        <div className={styles.formError}>
          <p>{t(generalError)}</p>
          {blockingRequests.length > 0 ? (
            <>
              <p>{t("journalist.request_form.blocking_requests_heading")}</p>
              <ul className={styles.blockingRequests}>
                {blockingRequests.map((r) => (
                  <li key={r.id}>
                    <Link href={`/${locale}/journalist/requests/${r.id}`}>{r.title}</Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
      {phase === "saved" ? <p className={styles.success}>{t("journalist.request_form.saved")}</p> : null}
      {phase === "submitted" ? (
        <p className={styles.success}>{t("journalist.request_form.submitted")}</p>
      ) : null}

      <TextField
        label={t("journalist.request_form.title_label")}
        value={values.title}
        onChange={(value) => set("title", value)}
        inputProps={{ maxLength: LIMITS.title }}
        isInvalid={Boolean(titleError)}
        errorMessage={titleError ? t(`errors.${titleError}`) : undefined}
      />
      <TextArea
        label={t("journalist.request_form.summary_label")}
        value={values.summary}
        onChange={(value) => set("summary", value)}
        maxLength={LIMITS.summary}
        rows={3}
        isInvalid={Boolean(summaryError)}
        errorMessage={summaryError ? t(`errors.${summaryError}`) : undefined}
      />
      <TextArea
        label={t("journalist.request_form.description_label")}
        value={values.description}
        onChange={(value) => set("description", value)}
        maxLength={LIMITS.description}
        rows={8}
        isInvalid={Boolean(descriptionError)}
        errorMessage={descriptionError ? t(`errors.${descriptionError}`) : undefined}
      />
      <TextArea
        label={t("journalist.request_form.target_person_label")}
        value={values.targetPersonDescription}
        onChange={(value) => set("targetPersonDescription", value)}
        maxLength={LIMITS.targetPersonDescription}
        rows={3}
        textareaProps={{ placeholder: t("journalist.request_form.target_person_placeholder") }}
        isInvalid={Boolean(targetPersonError)}
        errorMessage={targetPersonError ? t(`errors.${targetPersonError}`) : undefined}
      />
      <Select
        label={t("journalist.request_form.content_language_label")}
        options={languageOptions}
        selectedKey={values.contentLanguage}
        onSelectionChange={(key) => set("contentLanguage", String(key))}
        isRequired
      />
      <Select
        label={t("journalist.request_form.topic_label")}
        options={topicOptions}
        selectedKey={values.topic ?? NO_TOPIC}
        onSelectionChange={(key) => set("topic", key === null ? null : String(key))}
      />
      <TextField
        label={t("journalist.request_form.deadline_label")}
        description={t("journalist.request_form.deadline_description", { timezone })}
        value={values.responseDeadlineLocal}
        onChange={(value) => set("responseDeadlineLocal", value)}
        inputProps={{ type: "datetime-local" }}
        isInvalid={Boolean(deadlineError)}
        errorMessage={deadlineError ? t(`errors.${deadlineError}`) : undefined}
      />
      <RadioGroup
        label={t("journalist.request_form.anonymous_label")}
        value={toYesNo(values.allowsAnonymousParticipation) ?? null}
        onChange={(value) => set("allowsAnonymousParticipation", fromYesNo(value))}
        options={[
          { value: "yes", label: t("journalist.request_form.yes") },
          { value: "no", label: t("journalist.request_form.no") },
        ]}
        isInvalid={Boolean(anonymousError)}
        errorMessage={anonymousError ? t(`errors.${anonymousError}`) : undefined}
      />
      <RadioGroup
        label={t("journalist.request_form.recording_label")}
        value={toYesNo(values.mayBeRecorded) ?? null}
        onChange={(value) => set("mayBeRecorded", fromYesNo(value))}
        options={[
          { value: "yes", label: t("journalist.request_form.yes") },
          { value: "no", label: t("journalist.request_form.no") },
        ]}
        isInvalid={Boolean(recordedError)}
        errorMessage={recordedError ? t(`errors.${recordedError}`) : undefined}
      />
      <RadioGroup
        label={t("journalist.request_form.photo_video_label")}
        value={toYesNo(values.mayInvolvePhotoVideo) ?? null}
        onChange={(value) => set("mayInvolvePhotoVideo", fromYesNo(value))}
        options={[
          { value: "yes", label: t("journalist.request_form.yes") },
          { value: "no", label: t("journalist.request_form.no") },
        ]}
        isInvalid={Boolean(photoVideoError)}
        errorMessage={photoVideoError ? t(`errors.${photoVideoError}`) : undefined}
      />
      <TextField
        label={t("journalist.request_form.geographic_note_label")}
        value={values.geographicNote}
        onChange={(value) => set("geographicNote", value)}
        inputProps={{ maxLength: LIMITS.geographicNote }}
      />
      <TextField
        label={t("journalist.request_form.internal_reference_label")}
        value={values.internalReference}
        onChange={(value) => set("internalReference", value)}
        inputProps={{ maxLength: LIMITS.internalReference }}
      />

      <div className={styles.actions}>
        <Button variant="secondary" onPress={handleSave} isDisabled={busy}>
          {t("journalist.request_form.save")}
        </Button>
        <Button onPress={handleSubmit} isDisabled={busy}>
          {t("journalist.request_form.submit")}
        </Button>
      </div>
    </form>
  );
}
