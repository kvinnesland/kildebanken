"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import styles from "./SearchForm.module.css";

export function SearchForm({ locale, initialQuery }: { locale: SupportedLocale; initialQuery: string }) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(`/${locale}/admin/recipients?email=${encodeURIComponent(query.trim())}`);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <TextField
        label={t("admin.recipients.search_label")}
        value={query}
        onChange={setQuery}
      />
      <Button type="submit">{t("admin.recipients.search_button")}</Button>
    </form>
  );
}
