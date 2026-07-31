"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { match } from "@formatjs/intl-localematcher";
import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { TextField } from "@/components/TextField";
import { Select, type SelectOption } from "@/components/Select";
import { Checkbox } from "@/components/Checkbox";
import { Button } from "@/components/Button";
import styles from "./JournalistApplyForm.module.css";

interface CountryOption {
  code: string;
  nameKey: string;
  defaultLocale: string;
  availableLocales: string[];
}

type Status = "idle" | "loading_countries" | "submitting" | "success" | "error";

// Samme mønster som SubscribeForm.tsx sin `interpolateNodes` — se
// kommentaren der for hvorfor dette ikke går via IntlMessageFormat/ICU.
function interpolateNodes(template: string, replacements: Record<string, ReactNode>): ReactNode[] {
  return template
    .split(/(\{[a-zA-Z]+\})/g)
    .filter((part) => part !== "")
    .map((part, index) => {
      const key = /^\{([a-zA-Z]+)\}$/.exec(part)?.[1];
      if (key && key in replacements) {
        return <span key={index}>{replacements[key]}</span>;
      }
      return <span key={index}>{part}</span>;
    });
}

export function JournalistApplyForm({ locale }: { locale: SupportedLocale }) {
  const t = createTranslator(locale);

  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [status, setStatus] = useState<Status>("loading_countries");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const [fullName, setFullName] = useState("");
  const [jobEmail, setJobEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationUrl, setOrganizationUrl] = useState("");
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [regLocale, setRegLocale] = useState<string | null>(null);
  const [consentTerms, setConsentTerms] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/countries?requireDocumentTypes=journalist_terms")
      .then((res) => res.json())
      .then((data: { countries: CountryOption[] }) => {
        if (cancelled) return;
        setCountries(data.countries);
        setStatus("idle");
        if (typeof navigator === "undefined") return;
        const region = new Intl.Locale(navigator.language).maximize().region;
        const guessed = data.countries.find((c) => c.code === region);
        if (guessed) selectCountry(guessed.code, data.countries);
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
        setErrorKey("errors.generic");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectCountry(code: string | null, fromCountries: CountryOption[] = countries) {
    setCountryCode(code);
    const country = fromCountries.find((c) => c.code === code);
    if (country) {
      const preferred = typeof navigator !== "undefined" ? [...navigator.languages] : [];
      setRegLocale(match(preferred, country.availableLocales, country.defaultLocale));
    } else {
      setRegLocale(null);
    }
    setConsentTerms(false);
  }

  function selectLocale(code: string | null) {
    setRegLocale(code);
    setConsentTerms(false);
  }

  const selectedCountry = countries.find((c) => c.code === countryCode) ?? null;

  const emailValid = /\S+@\S+\.\S+/.test(jobEmail);
  const urlValid = (() => {
    try {
      new URL(organizationUrl);
      return true;
    } catch {
      return false;
    }
  })();
  const formValid =
    fullName.trim() !== "" &&
    emailValid &&
    jobTitle.trim() !== "" &&
    organizationName.trim() !== "" &&
    urlValid &&
    countryCode !== null &&
    regLocale !== null &&
    consentTerms;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (!formValid) return;

    setStatus("submitting");
    setErrorKey(null);
    try {
      const response = await fetch("/api/journalists/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          jobEmail,
          jobTitle,
          organizationName,
          organizationUrl,
          countryCode,
          locale: regLocale,
          consentJournalistTerms: consentTerms,
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

  if (status === "success") {
    return <p className={styles.success}>{t("journalist.apply.success")}</p>;
  }

  const countryOptions: SelectOption[] = countries.map((c) => ({ id: c.code, label: t(c.nameKey) }));
  const localeOptions: SelectOption[] = (selectedCountry?.availableLocales ?? []).map((code) => ({
    id: code,
    label: t(`locale.name.${code}`),
  }));

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {errorKey ? <p className={styles.formError}>{t(errorKey)}</p> : null}

      <TextField
        label={t("journalist.apply.full_name_label")}
        value={fullName}
        onChange={setFullName}
        isRequired
        isInvalid={attempted && fullName.trim() === ""}
        errorMessage={t("errors.field_required")}
      />

      <TextField
        label={t("journalist.apply.job_email_label")}
        value={jobEmail}
        onChange={setJobEmail}
        isRequired
        isInvalid={attempted && !emailValid}
        errorMessage={jobEmail ? t("errors.invalid_email") : t("errors.field_required")}
        inputProps={{ type: "email", autoComplete: "email" }}
      />

      <TextField
        label={t("journalist.apply.job_title_label")}
        value={jobTitle}
        onChange={setJobTitle}
        isRequired
        isInvalid={attempted && jobTitle.trim() === ""}
        errorMessage={t("errors.field_required")}
      />

      <TextField
        label={t("journalist.apply.organization_name_label")}
        value={organizationName}
        onChange={setOrganizationName}
        isRequired
        isInvalid={attempted && organizationName.trim() === ""}
        errorMessage={t("errors.field_required")}
      />

      <TextField
        label={t("journalist.apply.organization_url_label")}
        value={organizationUrl}
        onChange={setOrganizationUrl}
        isRequired
        isInvalid={attempted && !urlValid}
        errorMessage={t("errors.field_required")}
        inputProps={{ type: "url", autoComplete: "url" }}
      />

      <Select
        label={t("recipient.register.country_label")}
        options={countryOptions}
        placeholder={t("recipient.register.country_placeholder")}
        selectedKey={countryCode}
        onSelectionChange={(key) => selectCountry(key === null ? null : String(key))}
        isRequired
        isDisabled={status === "loading_countries"}
        isInvalid={attempted && countryCode === null}
        errorMessage={t("errors.field_required")}
      />

      <Select
        label={t("recipient.register.locale_label")}
        options={localeOptions}
        placeholder={t("recipient.register.locale_placeholder")}
        selectedKey={regLocale}
        onSelectionChange={(key) => selectLocale(key === null ? null : String(key))}
        isRequired
        isDisabled={!selectedCountry}
        isInvalid={attempted && regLocale === null}
        errorMessage={t("errors.field_required")}
      />

      {selectedCountry && regLocale ? (
        <Checkbox
          isSelected={consentTerms}
          onChange={setConsentTerms}
          isInvalid={attempted && !consentTerms}
        >
          {interpolateNodes(t("journalist.apply.consent_terms"), {
            termsLink: (
              <Link
                href={`/${locale}/legal/${selectedCountry.code}/${regLocale}/journalist_terms`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("legal.journalist_terms_title")}
              </Link>
            ),
          })}
        </Checkbox>
      ) : (
        <p className={styles.hint}>{t("recipient.register.select_country_first")}</p>
      )}

      <Button type="submit" isDisabled={status === "submitting"}>
        {status === "submitting" ? t("journalist.apply.submitting") : t("journalist.apply.submit")}
      </Button>
    </form>
  );
}
