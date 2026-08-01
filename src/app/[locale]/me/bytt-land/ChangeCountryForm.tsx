"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { createTranslator } from "@/i18n/get-messages";
import type { SupportedLocale } from "@/i18n/config";
import { Select, type SelectOption } from "@/components/Select";
import { Checkbox } from "@/components/Checkbox";
import { Button } from "@/components/Button";
import { focusFirstInvalidField } from "@/lib/forms/focus-first-invalid";
import styles from "./ChangeCountryForm.module.css";

interface CountryOption {
  code: string;
  nameKey: string;
  defaultLocale: string;
  availableLocales: string[];
  minimumAge: number;
}

type Status = "idle" | "loading_countries" | "submitting" | "success" | "error";

// Samme "{navn}"-i-oversatt-tekst-mønster som SubscribeForm.tsx — se den
// filens kommentar for hvorfor dette er en lokal løsning, ikke delt
// infrastruktur (foreløpig to steder som trenger det, fortsatt ikke verdt
// å bygge en generell "rich text i18n"-mekanisme for).
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

export function ChangeCountryForm({
  locale,
  currentCountryCode,
  currentLocale,
}: {
  locale: SupportedLocale;
  currentCountryCode: string;
  currentLocale: string;
}) {
  const t = createTranslator(locale);

  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [status, setStatus] = useState<Status>("loading_countries");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [newLocale, setNewLocale] = useState<string | null>(null);
  const [consentTerms, setConsentTerms] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/countries?requireDocumentTypes=terms,privacy")
      .then((res) => res.json())
      .then((data: { countries: CountryOption[] }) => {
        if (cancelled) return;
        setCountries(data.countries);
        setStatus("idle");
        // Forhåndsvelger brukerens NÅVÆRENDE land/språk — ikke et gjettet
        // hint slik SubscribeForm gjør ved førstegangsregistrering. Dette er
        // fortsatt bare en startverdi, ikke en stille avgjørelse: begge felt
        // vises og kan endres, og samtykket er aldri forhåndsavkrysset.
        setCountryCode(currentCountryCode);
        setNewLocale(currentLocale);
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

  function resetConsent() {
    setConsentTerms(false);
  }

  function selectCountry(code: string | null) {
    setCountryCode(code);
    const country = countries.find((c) => c.code === code);
    setNewLocale(country?.defaultLocale ?? null);
    // 7.1/7.3: "Endres land eller språk, lastes samtykketekstene på nytt, og
    // avkryssingene nullstilles."
    resetConsent();
  }

  function selectLocale(code: string | null) {
    setNewLocale(code);
    resetConsent();
  }

  const selectedCountry = countries.find((c) => c.code === countryCode) ?? null;
  const formValid = countryCode !== null && newLocale !== null && consentTerms;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (!formValid) {
      focusFirstInvalidField(formRef);
      return;
    }

    setStatus("submitting");
    setErrorKey(null);
    try {
      const response = await fetch("/api/me/change-country", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode, locale: newLocale, consentTerms }),
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
    return <p className={styles.success}>{t("me.change_country.success")}</p>;
  }

  const countryOptions: SelectOption[] = countries.map((c) => ({ id: c.code, label: t(c.nameKey) }));
  const localeOptions: SelectOption[] = (selectedCountry?.availableLocales ?? []).map((code) => ({
    id: code,
    label: t(`locale.name.${code}`),
  }));

  return (
    <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate>
      {errorKey ? <p className={styles.formError}>{t(errorKey)}</p> : null}

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
        selectedKey={newLocale}
        onSelectionChange={(key) => selectLocale(key === null ? null : String(key))}
        isRequired
        isDisabled={!selectedCountry}
        isInvalid={attempted && newLocale === null}
        errorMessage={t("errors.field_required")}
      />

      {selectedCountry && newLocale ? (
        <Checkbox isSelected={consentTerms} onChange={setConsentTerms} isInvalid={attempted && !consentTerms}>
          {interpolateNodes(t("recipient.register.consent_terms"), {
            termsLink: (
              <Link
                href={`/${locale}/legal/${selectedCountry.code}/${newLocale}/terms`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("common.footer.terms_link")}
              </Link>
            ),
            privacyLink: (
              <Link
                href={`/${locale}/legal/${selectedCountry.code}/${newLocale}/privacy`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("common.footer.privacy_link")}
              </Link>
            ),
          })}
        </Checkbox>
      ) : (
        <p className={styles.hint}>{t("recipient.register.select_country_first")}</p>
      )}

      <Button type="submit" isDisabled={status === "submitting"}>
        {status === "submitting" ? t("me.change_country.submitting") : t("me.change_country.submit")}
      </Button>
    </form>
  );
}
