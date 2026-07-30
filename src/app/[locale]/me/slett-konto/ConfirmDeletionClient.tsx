"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import styles from "./page.module.css";

type Status = "pending" | "success" | "error";

// POST /me/confirm-deletion (SPEC-V1.md 17.5, 24.3 — steg 2 av 2). Krever
// IKKE en aktiv økt (se rutens egen kommentar: tokenet ALENE er
// autoriteten) — derfor en ren klientside-fetch her, ikke en Route
// Handler-omdirigering slik magic_link/confirm_email bruker (de setter en
// cookie, noe en vanlig sideredirigering ikke kan gjøre; denne siden setter
// ingen cookie i det hele tatt).
export function ConfirmDeletionClient({ locale }: { locale: SupportedLocale }) {
  const t = createTranslator(locale);
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("pending");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      return;
    }

    fetch("/api/me/confirm-deletion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((response) => setStatus(response.ok ? "success" : "error"))
      .catch(() => setStatus("error"));
  }, [searchParams]);

  if (status === "pending") {
    return <p className={styles.notice}>{t("me.confirm_deletion.pending")}</p>;
  }
  if (status === "success") {
    return <p className={styles.success}>{t("me.confirm_deletion.success")}</p>;
  }
  return <p className={styles.error}>{t("me.confirm_deletion.error")}</p>;
}
