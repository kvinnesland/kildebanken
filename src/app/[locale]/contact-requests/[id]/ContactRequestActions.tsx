"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { Button } from "@/components/Button";
import styles from "./page.module.css";

type Status = "idle" | "busy" | "approved" | "declined";

export function ContactRequestActions({
  locale,
  contactRequestId,
}: {
  locale: SupportedLocale;
  contactRequestId: string;
}) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function respond(decision: "approve" | "decline") {
    setStatus("busy");
    setErrorKey(null);
    try {
      const response = await fetch(`/api/contact-requests/${contactRequestId}/${decision}`, {
        method: "POST",
      });
      if (response.ok) {
        setStatus(decision === "approve" ? "approved" : "declined");
        router.refresh();
        return;
      }
      // Nåbart i praksis, ikke bare teoretisk — respondToContactRequest()
      // sjekker expiresAt direkte (se contact-requests.ts), så en
      // kontaktforespørsel som denne siden viste som pending kan ha rukket å
      // utløpe før respondenten faktisk trykket. Uten dette feilet knappen
      // stille (bare re-aktivert), inkonsistent med resten av kodebasens
      // etablerte mønster.
      const data: { error?: string } = await response.json().catch(() => ({}));
      setErrorKey(data.error ?? "errors.generic");
      setStatus("idle");
    } catch {
      setErrorKey("errors.generic");
      setStatus("idle");
    }
  }

  if (status === "approved") {
    return <p className={styles.success}>{t("contact_request.approved_notice")}</p>;
  }
  if (status === "declined") {
    return <p className={styles.text}>{t("contact_request.declined_notice")}</p>;
  }

  return (
    <>
      {errorKey ? <p className={styles.formError}>{t(errorKey)}</p> : null}
      <div className={styles.actions}>
        <Button onPress={() => respond("approve")} isDisabled={status === "busy"}>
          {t("contact_request.approve_button")}
        </Button>
        <Button variant="secondary" onPress={() => respond("decline")} isDisabled={status === "busy"}>
          {t("contact_request.decline_button")}
        </Button>
      </div>
    </>
  );
}
