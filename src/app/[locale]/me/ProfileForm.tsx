"use client";

import { useState } from "react";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { TextField } from "@/components/TextField";
import { Select, type SelectOption } from "@/components/Select";
import { Button } from "@/components/Button";
import styles from "./forms.module.css";

export function ProfileForm({
  locale,
  availableLocales,
  initial,
}: {
  locale: SupportedLocale;
  availableLocales: string[];
  initial: { displayName: string; locale: string; timezone: string };
}) {
  const t = createTranslator(locale);

  const [displayName, setDisplayName] = useState(initial.displayName);
  const [profileLocale, setProfileLocale] = useState(initial.locale);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const localeOptions: SelectOption[] = availableLocales.map((code) => ({
    id: code,
    label: t(`locale.name.${code}`),
  }));

  async function handleSave() {
    setStatus("saving");
    setErrorKey(null);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() ? displayName.trim() : null,
          locale: profileLocale,
          timezone: timezone.trim() ? timezone.trim() : null,
        }),
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
      {errorKey ? <p className={styles.error}>{t(errorKey)}</p> : null}
      {status === "saved" ? <p className={styles.success}>{t("me.saved_notice")}</p> : null}

      <TextField
        label={t("me.display_name_label")}
        value={displayName}
        onChange={setDisplayName}
        inputProps={{ maxLength: 200 }}
      />
      <Select
        label={t("me.locale_label")}
        options={localeOptions}
        selectedKey={profileLocale}
        onSelectionChange={(key) => setProfileLocale(String(key))}
        isRequired
      />
      <TextField
        label={t("me.timezone_label")}
        description={t("me.timezone_description")}
        value={timezone}
        onChange={setTimezone}
        inputProps={{ placeholder: "Europe/Oslo" }}
      />
      <Button onPress={handleSave} isDisabled={status === "saving"}>
        {t("me.save")}
      </Button>
    </div>
  );
}
