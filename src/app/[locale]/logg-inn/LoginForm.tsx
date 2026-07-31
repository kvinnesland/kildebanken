"use client";

import { useRef, useState, type FormEvent } from "react";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { focusFirstInvalidField } from "@/lib/forms/focus-first-invalid";
import styles from "./LoginForm.module.css";

type Status = "idle" | "submitting" | "sent";

// SPEC-V1.md 6.1: "Kun e-post og engangslenke (magic link)." Ruten
// (POST /auth/request-link) svarer ALLTID likt uansett om e-posten finnes
// (src/app/api/auth/request-link/route.ts) — derfor er det ingen egen
// feiltilstand her utover en ugyldig e-postadresse; skjemaet viser
// suksessmeldingen uansett, med hensikt (avslører ikke om kontoen finnes).
export function LoginForm({ locale }: { locale: SupportedLocale }) {
  const t = createTranslator(locale);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [attempted, setAttempted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const emailValid = /\S+@\S+\.\S+/.test(email);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (!emailValid) {
      focusFirstInvalidField(formRef);
      return;
    }

    setStatus("submitting");
    try {
      await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Bevisst svelget — se kommentaren over. Selv en nettverksfeil skal
      // ikke avsløre noe eller vise en synlig feil.
    } finally {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return <p className={styles.success}>{t("auth.request_link.sent")}</p>;
  }

  return (
    <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate>
      <TextField
        label={t("auth.request_link.email_label")}
        value={email}
        onChange={setEmail}
        isRequired
        isInvalid={attempted && !emailValid}
        errorMessage={email ? t("errors.invalid_email") : t("errors.field_required")}
        inputProps={{ type: "email", autoComplete: "email" }}
      />
      <Button type="submit" isDisabled={status === "submitting"}>
        {t("auth.request_link.submit")}
      </Button>
    </form>
  );
}
