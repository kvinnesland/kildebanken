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
import styles from "./SubscribeForm.module.css";

interface CountryOption {
  code: string;
  nameKey: string;
  defaultLocale: string;
  availableLocales: string[];
  minimumAge: number;
}

type Status = "idle" | "loading_countries" | "submitting" | "success" | "error";

// Erstatter bokstavelige "{navn}"-plassholdere med React-noder (typisk
// klikkbare lenker) — IKKE via IntlMessageFormat/ICU, som ville krevd at hele
// i18n-laget (src/i18n/get-messages.ts) støtter "rich text"-verdier. Denne
// ene meldingen (recipient.register.consent_terms) er eneste stedet i
// plattformen som trenger klikkbare lenker inni en oversatt setning, så en
// enkel, lokal split-og-erstatt holder — ikke verdt å utvide delt
// infrastruktur for ett enkelt tilfelle ennå.
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

export function SubscribeForm({ locale }: { locale: SupportedLocale }) {
  const t = createTranslator(locale);

  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [status, setStatus] = useState<Status>("loading_countries");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [regLocale, setRegLocale] = useState<string | null>(null);
  const [consentEmail, setConsentEmail] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentAge, setConsentAge] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/countries?requireDocumentTypes=terms,privacy")
      .then((res) => res.json())
      .then((data: { countries: CountryOption[] }) => {
        if (cancelled) return;
        setCountries(data.countries);
        setStatus("idle");
        // SPEC-V1.md 7.1: land og språk forhåndsvelges fra et grovt
        // geografisk hint, men vises alltid og kan endres — dette er BARE en
        // startverdi, aldri en stille avgjørelse (i motsetning til
        // samtykkene, som ALDRI forhåndsavkrysses).
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

  function resetConsents() {
    setConsentEmail(false);
    setConsentTerms(false);
    setConsentAge(false);
  }

  function selectCountry(code: string | null, fromCountries: CountryOption[] = countries) {
    setCountryCode(code);
    const country = fromCountries.find((c) => c.code === code);
    if (country) {
      const preferred = typeof navigator !== "undefined" ? [...navigator.languages] : [];
      setRegLocale(match(preferred, country.availableLocales, country.defaultLocale));
    } else {
      setRegLocale(null);
    }
    // 7.1: "Endres land eller språk, lastes samtykketekstene på nytt, og
    // avkryssingene nullstilles."
    resetConsents();
  }

  function selectLocale(code: string | null) {
    setRegLocale(code);
    resetConsents();
  }

  const selectedCountry = countries.find((c) => c.code === countryCode) ?? null;

  const emailValid = /\S+@\S+\.\S+/.test(email);
  const formValid =
    emailValid && countryCode !== null && regLocale !== null && consentEmail && consentTerms && consentAge;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (!formValid) return;

    setStatus("submitting");
    setErrorKey(null);
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          countryCode,
          locale: regLocale,
          displayName: displayName.trim() ? displayName.trim() : undefined,
          consentEmailSubscription: consentEmail,
          consentTerms,
          consentMinimumAge: consentAge,
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
    return <p className={styles.success}>{t("recipient.register.success")}</p>;
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
        label={t("recipient.register.email_label")}
        value={email}
        onChange={setEmail}
        isRequired
        isInvalid={attempted && !emailValid}
        errorMessage={email ? t("errors.invalid_email") : t("errors.field_required")}
        inputProps={{ type: "email", autoComplete: "email" }}
      />

      <TextField
        label={t("recipient.register.display_name_label")}
        value={displayName}
        onChange={setDisplayName}
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
        <div className={styles.consents}>
          <Checkbox
            isSelected={consentEmail}
            onChange={setConsentEmail}
            isInvalid={attempted && !consentEmail}
          >
            {t("recipient.register.consent_email")}
          </Checkbox>

          <Checkbox
            isSelected={consentTerms}
            onChange={setConsentTerms}
            isInvalid={attempted && !consentTerms}
          >
            {interpolateNodes(t("recipient.register.consent_terms"), {
              termsLink: (
                <Link
                  href={`/${locale}/legal/${selectedCountry.code}/${regLocale}/terms`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("common.footer.terms_link")}
                </Link>
              ),
              privacyLink: (
                <Link
                  href={`/${locale}/legal/${selectedCountry.code}/${regLocale}/privacy`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("common.footer.privacy_link")}
                </Link>
              ),
            })}
          </Checkbox>

          <Checkbox
            isSelected={consentAge}
            onChange={setConsentAge}
            isInvalid={attempted && !consentAge}
          >
            {t("recipient.register.consent_age", { minimumAge: selectedCountry.minimumAge })}
          </Checkbox>
        </div>
      ) : (
        <p className={styles.hint}>{t("recipient.register.select_country_first")}</p>
      )}

      <Button type="submit" isDisabled={status === "submitting"}>
        {status === "submitting" ? t("recipient.register.submitting") : t("recipient.register.submit")}
      </Button>
    </form>
  );
}
