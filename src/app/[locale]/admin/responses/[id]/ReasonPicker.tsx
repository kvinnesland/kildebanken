"use client";

import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { Select, type SelectOption } from "@/components/Select";
import { ADMIN_RESPONSE_ACCESS_REASONS } from "@/lib/admin/response-access-reasons";

// SPEC-V1.md 16.2: "Åpning av et enkeltsvar ... krever at administratoren
// velger en begrunnelse fra en liste." Navigerer via URL-en (`?reason=`),
// samme mønster som CountrySelector.tsx sitt landvalg — siden forblir én
// enkelt server-rendret forespørsel per valg, ingen egen innsendingsknapp.
export function ReasonPicker({ locale, responseId }: { locale: SupportedLocale; responseId: string }) {
  const t = createTranslator(locale);
  const router = useRouter();

  const options: SelectOption[] = ADMIN_RESPONSE_ACCESS_REASONS.map((reason) => ({
    id: reason,
    label: t(`admin.response_detail.reason.${reason}`),
  }));

  return (
    <Select
      label={t("admin.response_detail.reason_label")}
      options={options}
      selectedKey={null}
      onSelectionChange={(key) => {
        if (key !== null) {
          router.push(`/${locale}/admin/responses/${responseId}?reason=${encodeURIComponent(String(key))}`);
        }
      }}
    />
  );
}
