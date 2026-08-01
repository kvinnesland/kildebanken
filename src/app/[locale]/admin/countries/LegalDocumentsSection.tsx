"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { TextField } from "@/components/TextField";
import { TextArea } from "@/components/TextArea";
import { Select } from "@/components/Select";
import { Checkbox } from "@/components/Checkbox";
import { Button } from "@/components/Button";
import styles from "./LegalDocumentsSection.module.css";

const DOCUMENT_TYPES = ["terms", "privacy", "journalist_terms"] as const;

interface LegalDocumentRow {
  id: string;
  rowLabel: string;
}

type Mode = "collapsed" | "expanded" | "busy" | "published";

export function LegalDocumentsSection({
  locale,
  countryCode,
  availableLocales,
  documents,
}: {
  locale: SupportedLocale;
  countryCode: string;
  availableLocales: string[];
  documents: LegalDocumentRow[];
}) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("collapsed");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [docLocale, setDocLocale] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<(typeof DOCUMENT_TYPES)[number] | null>(null);
  const [version, setVersion] = useState("");
  const [body, setBody] = useState("");
  const [isMaterialChange, setIsMaterialChange] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMode("busy");
    setErrorKey(null);

    const response = await fetch("/api/admin/legal-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        countryCode,
        locale: docLocale,
        documentType,
        version,
        body,
        isMaterialChange,
      }),
    });

    if (response.ok) {
      setMode("published");
      router.refresh();
    } else {
      const data: { error?: string } = await response.json().catch(() => ({}));
      setErrorKey(data.error ?? "errors.generic");
      setMode("expanded");
    }
  }

  const localeOptions = availableLocales.map((l) => ({ id: l, label: l }));
  const typeOptions = DOCUMENT_TYPES.map((type) => ({
    id: type,
    label: t(`admin.countries.legal_document_type.${type}`),
  }));

  return (
    <div className={styles.section}>
      <h3 className={styles.title}>{t("admin.countries.legal_documents_title")}</h3>

      {documents.length === 0 ? (
        <p className={styles.meta}>{t("admin.countries.legal_documents_empty")}</p>
      ) : (
        <ul className={styles.list}>
          {documents.map((doc) => (
            <li key={doc.id} className={styles.meta}>
              {doc.rowLabel}
            </li>
          ))}
        </ul>
      )}

      {mode === "published" ? (
        <p className={styles.notice}>{t("admin.countries.publish_success_notice")}</p>
      ) : mode === "collapsed" ? (
        <Button variant="secondary" onPress={() => setMode("expanded")}>
          {t("admin.countries.publish_document_button")}
        </Button>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {errorKey ? <p className={styles.formError}>{t(errorKey)}</p> : null}

          <Select
            label={t("admin.countries.publish_locale_label")}
            options={localeOptions}
            selectedKey={docLocale}
            onSelectionChange={(key) => setDocLocale(key as string | null)}
            isRequired
          />
          <Select
            label={t("admin.countries.publish_type_label")}
            options={typeOptions}
            selectedKey={documentType}
            onSelectionChange={(key) => setDocumentType(key as (typeof DOCUMENT_TYPES)[number] | null)}
            isRequired
          />
          <TextField
            label={t("admin.countries.publish_version_label")}
            value={version}
            onChange={setVersion}
            isRequired
          />
          <TextArea
            label={t("admin.countries.publish_body_label")}
            value={body}
            onChange={setBody}
            rows={6}
            isRequired
          />
          <Checkbox isSelected={isMaterialChange} onChange={setIsMaterialChange}>
            {t("admin.countries.publish_material_change_label")}
          </Checkbox>

          <div className={styles.actions}>
            <Button
              type="submit"
              isDisabled={mode === "busy" || !docLocale || !documentType || version.trim() === "" || body.trim() === ""}
            >
              {t("admin.countries.publish_submit")}
            </Button>
            <Button variant="secondary" onPress={() => setMode("collapsed")}>
              {t("admin.countries.cancel")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
