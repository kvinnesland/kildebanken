"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { Button } from "@/components/Button";
import styles from "./page.module.css";

type Status = "confirm" | "pending" | "success" | "error";

// POST /me/confirm-deletion (SPEC-V1.md 17.5 — steg 2 av 2). Krever IKKE en
// aktiv økt (se rutens egen kommentar: tokenet ALENE er autoriteten) —
// derfor en ren klientside-fetch her, ikke en Route Handler-omdirigering
// slik magic_link/confirm_email bruker (de setter en cookie, noe en vanlig
// sideredirigering ikke kan gjøre; denne siden setter ingen cookie i det
// hele tatt).
//
// Fyrer IKKE selve slettingen automatisk ved sideinnlasting lenger — krever
// et eksplisitt knappetrykk først. Rettet under kritisk gjennomlesing (se
// NATTLOGG.md): den opprinnelige versjonen kalte POST-en direkte i en
// useEffect ved mount, altså umiddelbart når SIDEN lastes, ikke når
// BRUKEREN faktisk bekrefter noe. Samme trusselbilde som ble lagt til grunn
// for engangstoken-TOCTOU-fiksen i verifyMagicLink()/confirmAccountDeletion()
// tidligere i natt (e-postsikkerhetsskannere som forhåndsbesøker lenker i
// innkommende e-post) rammer denne siden enda hardere: uten en egen
// bekreftelse her ville en slik skanner alene — helt uten at brukeren selv
// noensinne klikker noe på selve siden — trigget en reell, irreversibel
// kontosletting. Steg 1 (DeleteAccountSection.tsx, "Be om sletting av
// konto") krever allerede et eksplisitt knappetrykk før noe sendes i det
// hele tatt; steg 2 bør følge samme etablerte mønster, ikke fyre av
// automatisk.
export function ConfirmDeletionClient({ locale }: { locale: SupportedLocale }) {
  const t = createTranslator(locale);
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>(token ? "confirm" : "error");

  async function handleConfirm() {
    if (!token) return;
    setStatus("pending");
    try {
      const response = await fetch("/api/me/confirm-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setStatus(response.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "confirm") {
    return (
      <>
        <p className={styles.notice}>{t("me.confirm_deletion.warning")}</p>
        <Button variant="danger" onPress={handleConfirm}>
          {t("me.confirm_deletion.confirm_button")}
        </Button>
      </>
    );
  }
  if (status === "pending") {
    return <p className={styles.notice}>{t("me.confirm_deletion.pending")}</p>;
  }
  if (status === "success") {
    return <p className={styles.success}>{t("me.confirm_deletion.success")}</p>;
  }
  return <p className={styles.error}>{t("me.confirm_deletion.error")}</p>;
}
