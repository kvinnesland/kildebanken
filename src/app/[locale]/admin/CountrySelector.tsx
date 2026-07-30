"use client";

import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { Select, type SelectOption } from "@/components/Select";

// SPEC-V1.md 16.1: "landvelger for administrator" — kun administrator
// bruker denne (moderator ser automatisk sine tildelte land, se
// page.tsx). Navigerer via URL-en (`?country=`) i stedet for å hente data
// på klienten, slik at siden fortsatt er én enkelt server-rendret
// forespørsel per landbytte.
export function CountrySelector({
  locale,
  countries,
  selectedCountryCode,
}: {
  locale: SupportedLocale;
  countries: SelectOption[];
  selectedCountryCode?: string;
}) {
  const t = createTranslator(locale);
  const router = useRouter();

  return (
    <Select
      label={t("admin.dashboard.country_selector_label")}
      options={countries}
      selectedKey={selectedCountryCode ?? null}
      onSelectionChange={(key) => {
        if (key !== null) router.push(`/${locale}/admin?country=${encodeURIComponent(String(key))}`);
      }}
    />
  );
}
