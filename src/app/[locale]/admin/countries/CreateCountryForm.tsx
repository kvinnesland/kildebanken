"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { TextField } from "@/components/TextField";
import { Checkbox } from "@/components/Checkbox";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import styles from "./CreateCountryForm.module.css";

type Mode = "collapsed" | "expanded" | "busy" | "created";

export function CreateCountryForm({ locale }: { locale: SupportedLocale }) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("collapsed");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [nameKey, setNameKey] = useState("");
  const [availableLocales, setAvailableLocales] = useState<SupportedLocale[]>([]);
  const [defaultLocale, setDefaultLocale] = useState<SupportedLocale | null>(null);
  const [timezone, setTimezone] = useState("");
  const [minimumAge, setMinimumAge] = useState("18");
  const [digestSendTime, setDigestSendTime] = useState("07:00");
  // FR-029, SPEC-V1.md 9.2/26.1 punkt 5 — samme standardverdi som
  // DB-kolonnens egen DEFAULT (schema.ts).
  const [maxConcurrentPublishedRequests, setMaxConcurrentPublishedRequests] = useState("5");
  const [senderNameKey, setSenderNameKey] = useState("");
  const [supportEmail, setSupportEmail] = useState("");

  function toggleLocale(value: SupportedLocale, checked: boolean) {
    setAvailableLocales((current) =>
      checked ? [...current, value] : current.filter((l) => l !== value)
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMode("busy");
    setErrorKey(null);

    const response = await fetch("/api/admin/countries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        nameKey,
        defaultLocale,
        availableLocales,
        timezone,
        minimumAge: Number(minimumAge),
        digestSendTime,
        senderNameKey,
        supportEmail,
        maxConcurrentPublishedRequests: Number(maxConcurrentPublishedRequests),
      }),
    });

    if (response.ok) {
      setMode("created");
      router.refresh();
    } else {
      const data: { error?: string } = await response.json().catch(() => ({}));
      setErrorKey(data.error ?? "errors.generic");
      setMode("expanded");
    }
  }

  if (mode === "created") {
    return <p className={styles.notice}>{t("admin.countries.created_notice")}</p>;
  }

  if (mode === "collapsed") {
    return (
      <Button variant="secondary" onPress={() => setMode("expanded")}>
        {t("admin.countries.create_button")}
      </Button>
    );
  }

  const localeOptions = SUPPORTED_LOCALES.filter((l) => availableLocales.includes(l)).map((l) => ({
    id: l,
    label: t(`locale.name.${l}`),
  }));

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2 className={styles.title}>{t("admin.countries.create_title")}</h2>

      {errorKey ? <p className={styles.formError}>{t(errorKey)}</p> : null}

      <TextField
        label={t("admin.countries.code_label")}
        value={code}
        onChange={(value) => setCode(value.toUpperCase())}
        inputProps={{ maxLength: 2 }}
        isRequired
      />
      <TextField
        label={t("admin.countries.name_key_label")}
        description={t("admin.countries.name_key_help")}
        value={nameKey}
        onChange={setNameKey}
        isRequired
      />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t("admin.countries.available_locales_label")}</legend>
        {SUPPORTED_LOCALES.map((l) => (
          <Checkbox
            key={l}
            isSelected={availableLocales.includes(l)}
            onChange={(checked) => toggleLocale(l, checked)}
          >
            {t(`locale.name.${l}`)}
          </Checkbox>
        ))}
      </fieldset>

      <Select
        label={t("admin.countries.default_locale_label")}
        options={localeOptions}
        selectedKey={defaultLocale}
        onSelectionChange={(key) => setDefaultLocale(key as SupportedLocale | null)}
        isDisabled={localeOptions.length === 0}
        isRequired
      />

      <TextField
        label={t("admin.countries.timezone_label")}
        value={timezone}
        onChange={setTimezone}
        inputProps={{ placeholder: "Europe/Oslo" }}
        isRequired
      />
      <TextField
        label={t("admin.countries.minimum_age_label")}
        value={minimumAge}
        onChange={setMinimumAge}
        inputProps={{ type: "number", min: 0, max: 100 }}
        isRequired
      />
      <TextField
        label={t("admin.countries.max_concurrent_published_requests_label")}
        value={maxConcurrentPublishedRequests}
        onChange={setMaxConcurrentPublishedRequests}
        inputProps={{ type: "number", min: 1 }}
        isRequired
      />
      <TextField
        label={t("admin.countries.digest_send_time_label")}
        value={digestSendTime}
        onChange={setDigestSendTime}
        inputProps={{ placeholder: "07:00" }}
        isRequired
      />
      <TextField
        label={t("admin.countries.sender_name_key_label")}
        description={t("admin.countries.sender_name_key_help")}
        value={senderNameKey}
        onChange={setSenderNameKey}
        isRequired
      />
      <TextField
        label={t("admin.countries.support_email_label")}
        value={supportEmail}
        onChange={setSupportEmail}
        inputProps={{ type: "email" }}
        isRequired
      />

      <div className={styles.actions}>
        <Button type="submit" isDisabled={mode === "busy" || !defaultLocale}>
          {t("admin.countries.submit_create")}
        </Button>
        <Button variant="secondary" onPress={() => setMode("collapsed")}>
          {t("admin.countries.cancel")}
        </Button>
      </div>
    </form>
  );
}
