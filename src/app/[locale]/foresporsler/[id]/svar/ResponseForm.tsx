"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { TextField } from "@/components/TextField";
import { TextArea } from "@/components/TextArea";
import { RadioGroup } from "@/components/RadioGroup";
import { Button } from "@/components/Button";
import { focusFirstInvalidField } from "@/lib/forms/focus-first-invalid";
// Importert i stedet for en egen, duplisert kopi (reelt hull frem til nå,
// se NATTLOGG.md) — samme grenser skal uansett gjelde her som i
// serverens validateResponseSubmission(), og en lokal kopi kunne stille
// gli fra serverens verdi uten at noe fanget det, samme bugklasse som
// task #57/#59/#126/#127.
import { RESPONSE_FIELD_LIMITS as LIMITS } from "@/lib/responses/validate";
import styles from "./ResponseForm.module.css";

type Step = "form" | "confirm" | "submitting" | "success" | "error";
type ContactSharing = "none" | "email";

interface DraftValues {
  relevanceStatement: string;
  answerText: string;
  shortBio: string;
  displayName: string;
  contactSharing: ContactSharing;
}

// DESIGN.md 5: "Skjematilstand overlever at nettleseren legges i
// bakgrunnen. Et halvskrevet svar på 2 000 tegn skal ikke forsvinne fordi
// noen sjekket en melding underveis. Lokal mellomlagring i nettleseren,
// ikke på server." Manglet HELT frem til nå (reelt hull, se NATTLOGG.md,
// økt 95) — ren React-state, ingenting persistert, så en bakgrunnslagt
// eller gjenoppfrisket fane (vanlig iOS/Android-oppførsel når minnet er
// knapt) mistet alt. Nøkkelen inkluderer requestId slik at et utkast for
// én forespørsel aldri lekker inn i en annen.
function draftStorageKey(requestId: string): string {
  return `kildebanken:response-draft:${requestId}`;
}

function loadDraft(requestId: string): Partial<DraftValues> | null {
  try {
    const raw = window.localStorage.getItem(draftStorageKey(requestId));
    if (!raw) return null;
    return JSON.parse(raw) as Partial<DraftValues>;
  } catch {
    // localStorage kan være utilgjengelig (privat nettlesing i Safari,
    // kvote full, m.m.) — mellomlagring er en bekvemmelighet, ikke en
    // kritisk vei, og skal aldri stoppe selve utfyllingen.
    return null;
  }
}

function saveDraft(requestId: string, draft: DraftValues): void {
  try {
    window.localStorage.setItem(draftStorageKey(requestId), JSON.stringify(draft));
  } catch {
    // Se loadDraft() sin egen kommentar.
  }
}

function clearDraft(requestId: string): void {
  try {
    window.localStorage.removeItem(draftStorageKey(requestId));
  } catch {
    // Se loadDraft() sin egen kommentar.
  }
}

export function ResponseForm({
  locale,
  requestId,
  journalistName,
  organizationName,
  sessionEmail,
  sessionDisplayName,
}: {
  locale: SupportedLocale;
  requestId: string;
  journalistName: string;
  organizationName: string;
  sessionEmail: string;
  sessionDisplayName: string | null;
}) {
  const t = createTranslator(locale);

  const [step, setStep] = useState<Step>("form");
  const [attempted, setAttempted] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [relevanceStatement, setRelevanceStatement] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [shortBio, setShortBio] = useState("");
  // SPEC-V1.md 12.1: "Visningsnavn | valgfritt, forhåndsutfylt fra kontoen".
  const [displayName, setDisplayName] = useState(sessionDisplayName ?? "");
  const [contactSharing, setContactSharing] = useState<ContactSharing>("none");
  // Unngår at gjenopprettingseffekten under (kjører etter hydrering) skriver
  // over et FERSKT utkast med et gammelt fra localStorage rett før det
  // uansett ville blitt lagret på nytt — kjøres kun én gang per montering.
  const restoredDraftRef = useRef(false);

  // DESIGN.md 5 — se draftStorageKey() sin egen kommentar over. Leses i en
  // effekt (ikke en lat useState-initialiserer) med hensikt: en
  // "use client"-komponent rendres først på SERVEREN for SSR-HTML-en, der
  // `window` ikke finnes — å lese localStorage synkront under selve
  // renderingen ville gitt et hydreringsavvik mellom server og klient.
  useEffect(() => {
    if (restoredDraftRef.current) return;
    restoredDraftRef.current = true;
    const draft = loadDraft(requestId);
    if (!draft) return;
    if (draft.relevanceStatement) setRelevanceStatement(draft.relevanceStatement);
    if (draft.answerText) setAnswerText(draft.answerText);
    if (draft.shortBio) setShortBio(draft.shortBio);
    if (draft.displayName) setDisplayName(draft.displayName);
    if (draft.contactSharing) setContactSharing(draft.contactSharing);
  }, [requestId]);

  // Lagres på HVER endring, bevisst UTEN debounce — poenget er nettopp å
  // overleve at fanen legges i bakgrunnen eller gjenoppfriskes midt i en
  // innskriving, og en forsinket skriving kunne mistet akkurat det siste,
  // ulagrede tegnet i det øyeblikket.
  useEffect(() => {
    if (step !== "form") return;
    saveDraft(requestId, { relevanceStatement, answerText, shortBio, displayName, contactSharing });
  }, [requestId, step, relevanceStatement, answerText, shortBio, displayName, contactSharing]);

  const relevanceValid =
    relevanceStatement.trim() !== "" && relevanceStatement.length <= LIMITS.relevanceStatement;
  const answerValid = answerText.trim() !== "" && answerText.length <= LIMITS.answerText;
  const shortBioValid = shortBio.length <= LIMITS.shortBio;
  const displayNameValid = displayName.length <= LIMITS.displayName;
  const formValid = relevanceValid && answerValid && shortBioValid && displayNameValid;

  function handleContinue(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (!formValid) {
      focusFirstInvalidField(formRef);
      return;
    }
    setStep("confirm");
  }

  async function handleConfirm() {
    setStep("submitting");
    setErrorKey(null);
    try {
      const response = await fetch(`/api/requests/${requestId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relevanceStatement,
          answerText,
          shortBio: shortBio.trim() ? shortBio.trim() : undefined,
          displayName: displayName.trim() ? displayName.trim() : undefined,
          contactSharing,
        }),
      });
      const data: { error?: string } = await response.json();
      if (!response.ok) {
        setStep("error");
        setErrorKey(data.error ?? "errors.generic");
        return;
      }
      setStep("success");
      // DESIGN.md 5 sitt mellomlagring er en bekvemmelighet under
      // utfylling, ikke en varig lagringsplass — et vellykket innsendt svar
      // skal ikke la et gammelt utkast dukke opp igjen ved en senere
      // besøk (f.eks. et forsøk på å svare på nytt, avvist av den unike
      // indeksen, FR-041).
      clearDraft(requestId);
    } catch {
      setStep("error");
      setErrorKey("errors.generic");
    }
  }

  if (step === "success") {
    return <p className={styles.success}>{t("response.success")}</p>;
  }

  if (step === "confirm" || step === "submitting" || step === "error") {
    return (
      <div className={styles.confirm}>
        <h2 className={styles.confirmTitle}>{t("response.confirm.title")}</h2>
        {errorKey ? <p className={styles.formError}>{t(errorKey)}</p> : null}
        <ul className={styles.confirmList}>
          <li>{t("response.form.confirm_journalist", { journalistName, organizationName })}</li>
          <li>
            {contactSharing === "email"
              ? t("response.confirm.sharing_email", { email: sessionEmail })
              : t("response.confirm.sharing_none")}
          </li>
          <li>{t("response.confirm.may_be_quoted")}</li>
          <li>{t("response.form.confirm_no_guarantee")}</li>
          <li>{t("response.confirm.journalist_responsibility")}</li>
          <li>{t("response.confirm.platform_verification")}</li>
          <li>{t("response.confirm.no_withdrawal_from_journalist")}</li>
        </ul>
        <div className={styles.actions}>
          <Button onPress={handleConfirm} isDisabled={step === "submitting"}>
            {t("response.confirm.submit")}
          </Button>
          <Button variant="secondary" onPress={() => setStep("form")} isDisabled={step === "submitting"}>
            {t("response.confirm.back")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} className={styles.form} onSubmit={handleContinue} noValidate>
      <TextArea
        label={t("response.form.relevance_label")}
        value={relevanceStatement}
        onChange={setRelevanceStatement}
        maxLength={LIMITS.relevanceStatement}
        isRequired
        isInvalid={attempted && !relevanceValid}
        errorMessage={t("errors.field_required")}
        rows={4}
      />
      <TextArea
        label={t("response.form.answer_label")}
        value={answerText}
        onChange={setAnswerText}
        maxLength={LIMITS.answerText}
        isRequired
        isInvalid={attempted && !answerValid}
        errorMessage={t("errors.field_required")}
        rows={6}
      />
      <TextArea
        label={t("response.form.short_bio_label")}
        value={shortBio}
        onChange={setShortBio}
        maxLength={LIMITS.shortBio}
        rows={3}
      />
      <TextField
        label={t("response.form.display_name_label")}
        value={displayName}
        onChange={setDisplayName}
        inputProps={{ maxLength: LIMITS.displayName }}
      />
      <RadioGroup
        label={t("response.form.contact_sharing_label")}
        value={contactSharing}
        onChange={(value) => setContactSharing(value as ContactSharing)}
        options={[
          { value: "none", label: t("response.form.contact_sharing_none") },
          { value: "email", label: t("response.form.contact_sharing_email") },
        ]}
      />
      <Button type="submit">{t("response.form.next")}</Button>
    </form>
  );
}
