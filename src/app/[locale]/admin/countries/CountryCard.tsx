"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { TextField } from "@/components/TextField";
import { Checkbox } from "@/components/Checkbox";
import { Select } from "@/components/Select";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { LegalDocumentsSection } from "./LegalDocumentsSection";
import styles from "./CountryCard.module.css";

interface CountryData {
  code: string;
  nameKey: string;
  defaultLocale: string;
  availableLocales: string[];
  timezone: string;
  minimumAge: number;
  digestSendTime: string;
  senderNameKey: string;
  supportEmail: string;
  status: "draft" | "active" | "paused";
  statusLabel: string;
}

const STATUS_VALUES = ["draft", "active", "paused"] as const;

export function CountryCard({
  locale,
  country,
  supportedLocales,
  documents,
}: {
  locale: SupportedLocale;
  country: CountryData;
  supportedLocales: string[];
  documents: { id: string; rowLabel: string }[];
}) {
  const t = createTranslator(locale);
  const router = useRouter();

  // Feltredigering (PATCH, felt-delen).
  const [editMode, setEditMode] = useState<"view" | "editing" | "busy">("view");
  const [editErrorKey, setEditErrorKey] = useState<string | null>(null);
  const [editNotice, setEditNotice] = useState(false);
  const [nameKey, setNameKey] = useState(country.nameKey);
  const [availableLocales, setAvailableLocales] = useState<string[]>(country.availableLocales);
  const [defaultLocale, setDefaultLocale] = useState<string | null>(country.defaultLocale);
  const [timezone, setTimezone] = useState(country.timezone);
  const [minimumAge, setMinimumAge] = useState(String(country.minimumAge));
  const [digestSendTime, setDigestSendTime] = useState(country.digestSendTime);
  const [senderNameKey, setSenderNameKey] = useState(country.senderNameKey);
  const [supportEmail, setSupportEmail] = useState(country.supportEmail);

  // Statusbytte (PATCH, status-delen — se setCountryStatus() for hvorfor
  // dette er en EGEN handling, ikke bundlet med feltredigeringen over).
  const [statusValue, setStatusValue] = useState<(typeof STATUS_VALUES)[number]>(country.status);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusErrorKey, setStatusErrorKey] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState(false);

  // Tildel moderator.
  const [moderatorMode, setModeratorMode] = useState<"collapsed" | "expanded" | "busy">("collapsed");
  const [moderatorEmail, setModeratorEmail] = useState("");
  const [moderatorErrorKey, setModeratorErrorKey] = useState<string | null>(null);
  const [moderatorNotice, setModeratorNotice] = useState(false);

  function toggleLocale(value: string, checked: boolean) {
    setAvailableLocales((current) => (checked ? [...current, value] : current.filter((l) => l !== value)));
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditMode("busy");
    setEditErrorKey(null);
    setEditNotice(false);

    const response = await fetch(`/api/admin/countries/${country.code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nameKey,
        defaultLocale,
        availableLocales,
        timezone,
        minimumAge: Number(minimumAge),
        digestSendTime,
        senderNameKey,
        supportEmail,
      }),
    });

    if (response.ok) {
      setEditMode("view");
      setEditNotice(true);
      router.refresh();
    } else {
      const data: { error?: string } = await response.json().catch(() => ({}));
      setEditErrorKey(data.error ?? "errors.generic");
      setEditMode("editing");
    }
  }

  async function handleStatusChange() {
    setStatusBusy(true);
    setStatusErrorKey(null);
    setStatusNotice(false);

    const response = await fetch(`/api/admin/countries/${country.code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: statusValue }),
    });

    setStatusBusy(false);
    if (response.ok) {
      setStatusNotice(true);
      router.refresh();
    } else {
      const data: { error?: string } = await response.json().catch(() => ({}));
      setStatusErrorKey(data.error ?? "errors.generic");
    }
  }

  async function handleAssignModerator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setModeratorMode("busy");
    setModeratorErrorKey(null);
    setModeratorNotice(false);

    const response = await fetch(`/api/admin/countries/${country.code}/moderators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: moderatorEmail }),
    });

    if (response.ok) {
      setModeratorMode("collapsed");
      setModeratorEmail("");
      setModeratorNotice(true);
      router.refresh();
    } else {
      const data: { error?: string } = await response.json().catch(() => ({}));
      setModeratorErrorKey(data.error ?? "errors.generic");
      setModeratorMode("expanded");
    }
  }

  const localeOptions = supportedLocales
    .filter((l) => availableLocales.includes(l))
    .map((l) => ({ id: l, label: t(`locale.name.${l}`) }));
  const statusOptions = STATUS_VALUES.map((s) => ({ id: s, label: t(`admin.countries.status.${s}`) }));

  return (
    <li className={styles.item}>
      <Card title={country.code}>
        <div className={styles.body}>
          {editMode === "view" ? (
            <>
              <dl className={styles.fieldList}>
                <div className={styles.field}>
                  <dt className={styles.fieldLabel}>{t("admin.countries.name_key_label")}</dt>
                  <dd className={styles.fieldValue}>{country.nameKey}</dd>
                </div>
                <div className={styles.field}>
                  <dt className={styles.fieldLabel}>{t("admin.countries.status_label")}</dt>
                  <dd className={styles.fieldValue}>{country.statusLabel}</dd>
                </div>
                <div className={styles.field}>
                  <dt className={styles.fieldLabel}>{t("admin.countries.default_locale_label")}</dt>
                  <dd className={styles.fieldValue}>{country.defaultLocale}</dd>
                </div>
                <div className={styles.field}>
                  <dt className={styles.fieldLabel}>{t("admin.countries.available_locales_label")}</dt>
                  <dd className={styles.fieldValue}>{country.availableLocales.join(", ")}</dd>
                </div>
                <div className={styles.field}>
                  <dt className={styles.fieldLabel}>{t("admin.countries.timezone_label")}</dt>
                  <dd className={styles.fieldValue}>{country.timezone}</dd>
                </div>
                <div className={styles.field}>
                  <dt className={styles.fieldLabel}>{t("admin.countries.minimum_age_label")}</dt>
                  <dd className={styles.fieldValue}>{country.minimumAge}</dd>
                </div>
                <div className={styles.field}>
                  <dt className={styles.fieldLabel}>{t("admin.countries.digest_send_time_label")}</dt>
                  <dd className={styles.fieldValue}>{country.digestSendTime}</dd>
                </div>
                <div className={styles.field}>
                  <dt className={styles.fieldLabel}>{t("admin.countries.sender_name_key_label")}</dt>
                  <dd className={styles.fieldValue}>{country.senderNameKey}</dd>
                </div>
                <div className={styles.field}>
                  <dt className={styles.fieldLabel}>{t("admin.countries.support_email_label")}</dt>
                  <dd className={styles.fieldValue}>{country.supportEmail}</dd>
                </div>
              </dl>

              {editNotice ? <p className={styles.notice}>{t("admin.countries.updated_notice")}</p> : null}

              <Button variant="secondary" onPress={() => setEditMode("editing")}>
                {t("admin.countries.edit_button")}
              </Button>
            </>
          ) : (
            <form className={styles.form} onSubmit={handleEditSubmit} noValidate>
              {editErrorKey ? <p className={styles.formError}>{t(editErrorKey)}</p> : null}

              <TextField
                label={t("admin.countries.name_key_label")}
                description={t("admin.countries.name_key_help")}
                value={nameKey}
                onChange={setNameKey}
                isRequired
              />

              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>{t("admin.countries.available_locales_label")}</legend>
                {supportedLocales.map((l) => (
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
                onSelectionChange={(key) => setDefaultLocale(key as string | null)}
                isDisabled={localeOptions.length === 0}
                isRequired
              />

              <TextField
                label={t("admin.countries.timezone_label")}
                value={timezone}
                onChange={setTimezone}
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
                label={t("admin.countries.digest_send_time_label")}
                value={digestSendTime}
                onChange={setDigestSendTime}
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
                <Button type="submit" isDisabled={editMode === "busy" || !defaultLocale}>
                  {t("admin.countries.submit_edit")}
                </Button>
                <Button variant="secondary" onPress={() => setEditMode("view")}>
                  {t("admin.countries.cancel")}
                </Button>
              </div>
            </form>
          )}

          <div className={styles.statusRow}>
            {statusErrorKey ? <p className={styles.formError}>{t(statusErrorKey)}</p> : null}
            {statusNotice ? <p className={styles.notice}>{t("admin.countries.status_changed_notice")}</p> : null}
            <Select
              label={t("admin.countries.status_label")}
              options={statusOptions}
              selectedKey={statusValue}
              onSelectionChange={(key) => setStatusValue(key as (typeof STATUS_VALUES)[number])}
            />
            <Button variant="secondary" onPress={handleStatusChange} isDisabled={statusBusy}>
              {t("admin.countries.change_status_button")}
            </Button>
          </div>

          <div className={styles.moderatorSection}>
            <h3 className={styles.sectionTitle}>{t("admin.countries.assign_moderator_title")}</h3>
            {moderatorNotice ? (
              <p className={styles.notice}>{t("admin.countries.assign_moderator_notice")}</p>
            ) : null}
            {moderatorMode === "collapsed" ? (
              <Button variant="secondary" onPress={() => setModeratorMode("expanded")}>
                {t("admin.countries.assign_moderator_title")}
              </Button>
            ) : (
              <form className={styles.form} onSubmit={handleAssignModerator} noValidate>
                {moderatorErrorKey ? <p className={styles.formError}>{t(moderatorErrorKey)}</p> : null}
                <TextField
                  label={t("admin.countries.assign_moderator_email_label")}
                  value={moderatorEmail}
                  onChange={setModeratorEmail}
                  inputProps={{ type: "email" }}
                  isRequired
                />
                <div className={styles.actions}>
                  <Button type="submit" isDisabled={moderatorMode === "busy" || moderatorEmail.trim() === ""}>
                    {t("admin.countries.assign_moderator_button")}
                  </Button>
                  <Button variant="secondary" onPress={() => setModeratorMode("collapsed")}>
                    {t("admin.countries.cancel")}
                  </Button>
                </div>
              </form>
            )}
          </div>

          <LegalDocumentsSection
            locale={locale}
            countryCode={country.code}
            availableLocales={country.availableLocales}
            documents={documents}
          />
        </div>
      </Card>
    </li>
  );
}
