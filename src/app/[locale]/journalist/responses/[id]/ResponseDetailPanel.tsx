"use client";

import { useState } from "react";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { RadioGroup } from "@/components/RadioGroup";
import { TextArea } from "@/components/TextArea";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import styles from "./ResponseDetailPanel.module.css";

type Marking = "unreviewed" | "shortlisted" | "not_selected";

const NOTE_LIMIT = 4000;
const MESSAGE_LIMIT = 1000;

export function ResponseDetailPanel({
  locale,
  responseId,
  initialMarking,
  initialNote,
  showContactRequestForm,
}: {
  locale: SupportedLocale;
  responseId: string;
  initialMarking: Marking;
  initialNote: string;
  showContactRequestForm: boolean;
}) {
  const t = createTranslator(locale);

  const [marking, setMarking] = useState<Marking>(initialMarking);
  const [note, setNote] = useState(initialNote);
  const [savingStatus, setSavingStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [markingError, setMarkingError] = useState<string | null>(null);

  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  const [contactMethod, setContactMethod] = useState("");
  const [contactStatus, setContactStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [contactError, setContactError] = useState<string | null>(null);

  async function handleSaveMarking() {
    setSavingStatus("saving");
    setMarkingError(null);
    try {
      const response = await fetch(`/api/journalist/responses/${responseId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marking, note }),
      });
      if (!response.ok) {
        const data: { error?: string } = await response.json().catch(() => ({}));
        setMarkingError(data.error ?? "errors.generic");
        setSavingStatus("idle");
        return;
      }
      setSavingStatus("saved");
    } catch {
      setMarkingError("errors.generic");
      setSavingStatus("idle");
    }
  }

  async function handleSendContactRequest() {
    setContactStatus("sending");
    setContactError(null);
    const response = await fetch(`/api/journalist/responses/${responseId}/contact-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: contactMessage, requestedContactMethod: contactMethod }),
    });
    const data: { error?: string } = await response.json();
    if (response.ok) {
      setContactStatus("sent");
    } else {
      setContactStatus("error");
      setContactError(data.error ?? "errors.generic");
    }
  }

  return (
    <div className={styles.panel}>
      <RadioGroup
        label={t("journalist.response_detail.marking_label")}
        value={marking}
        onChange={(value) => setMarking(value as Marking)}
        options={[
          { value: "unreviewed", label: t("journalist.response_detail.marking_unreviewed") },
          { value: "shortlisted", label: t("journalist.response_detail.marking_shortlisted") },
          { value: "not_selected", label: t("journalist.response_detail.marking_not_selected") },
        ]}
      />
      <TextArea
        label={t("journalist.response_detail.note_label")}
        value={note}
        onChange={setNote}
        maxLength={NOTE_LIMIT}
        rows={3}
      />
      {markingError ? <p className={styles.error}>{t(markingError)}</p> : null}
      <div className={styles.actions}>
        <Button onPress={handleSaveMarking} isDisabled={savingStatus === "saving"}>
          {t("journalist.response_detail.save_marking")}
        </Button>
        {savingStatus === "saved" ? (
          <span className={styles.savedNotice}>{t("journalist.response_detail.saved_notice")}</span>
        ) : null}
      </div>

      {showContactRequestForm && contactStatus !== "sent" ? (
        contactFormOpen ? (
          <div className={styles.contactForm}>
            {contactError ? <p className={styles.error}>{t(contactError)}</p> : null}
            <TextArea
              label={t("journalist.response_detail.contact_request_message_label")}
              value={contactMessage}
              onChange={setContactMessage}
              maxLength={MESSAGE_LIMIT}
              rows={3}
            />
            <TextField
              label={t("journalist.response_detail.contact_request_method_label")}
              value={contactMethod}
              onChange={setContactMethod}
              inputProps={{ placeholder: t("journalist.response_detail.contact_request_method_placeholder") }}
            />
            <div className={styles.actions}>
              <Button
                onPress={handleSendContactRequest}
                isDisabled={
                  contactStatus === "sending" || contactMessage.trim() === "" || contactMethod.trim() === ""
                }
              >
                {t("journalist.response_detail.contact_request_send")}
              </Button>
              <Button variant="secondary" onPress={() => setContactFormOpen(false)}>
                {t("journalist.response_detail.contact_request_cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" onPress={() => setContactFormOpen(true)}>
            {t("journalist.response_detail.contact_request_button")}
          </Button>
        )
      ) : null}

      {contactStatus === "sent" ? (
        <p className={styles.savedNotice}>{t("journalist.response_detail.contact_request_sent_notice")}</p>
      ) : null}
    </div>
  );
}
