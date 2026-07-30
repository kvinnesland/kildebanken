// Tynt e-postgrensesnitt. Selve jobblogikken (src/lib/jobs/tick.ts) kaller
// bare denne — ikke Brevo sitt SDK direkte — slik at et bytte av
// e-postleverandør (skulle det noen gang bli aktuelt) er isolert til denne
// filen. Se INFRASTRUCTURE.md 16.8 for samme prinsipp anvendt på hosting.
//
// TODO (neste iterasjon): faktisk Brevo-integrasjon (transaksjonelt API for
// disse malene, bulk-API for digest via src/lib/email/digest.ts). Malnavnene
// under er de eksakte navnene fra SPEC-V1.md 15 og må ikke endres uten å
// oppdatere spec-en samtidig.

export type TransactionalTemplate =
  | "confirm_email"
  | "magic_link"
  | "journalist_application_received"
  | "journalist_approved"
  | "journalist_rejected"
  | "request_approved_published"
  | "changes_requested"
  | "request_rejected"
  | "new_response_received"
  | "contact_approved"
  | "contact_declined"
  | "deadline_approaching_24h"
  | "stale_request_reminder_30d"
  | "request_closed"
  | "response_submitted_receipt"
  | "contact_request_received"
  | "response_request_closed"
  | "confirm_account_deletion"
  | "account_deletion_confirmed"
  | "contact_request_cancelled_account_deleted"
  | "legal_terms_material_change"
  | "new_request_for_moderation"
  | "content_reported";

export interface SendTransactionalEmailInput {
  template: TransactionalTemplate;
  to: { email: string; locale: string };
  data: Record<string, unknown>;
}

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput
): Promise<void> {
  if (!process.env.BREVO_API_KEY) {
    console.warn(
      `[email:stub] ${input.template} → ${input.to.email} (${input.to.locale})`,
      input.data
    );
    return;
  }

  throw new Error(
    `sendTransactionalEmail: Brevo-integrasjon ikke implementert ennå (mal: ${input.template}). ` +
      "Se TODO i src/lib/email/send.ts."
  );
}

export interface SendBulkEmailInput {
  to: { email: string; locale: string };
  subject: string;
  html: string;
  text: string;
}

/**
 * Egen funksjon for den daglige digesten — atskilt fra
 * `sendTransactionalEmail` med hensikt (`INFRASTRUCTURE.md` 6.1: "atskilte
 * strømmer for transaksjonell e-post og bulk, slik at en klage på digesten
 * ikke ødelegger leveringen av innloggingslenker"). Når Brevo faktisk kobles
 * til, skal denne bruke bulk-/kampanje-API-et, ikke det transaksjonelle.
 */
export async function sendBulkEmail(input: SendBulkEmailInput): Promise<void> {
  if (!process.env.BREVO_API_KEY) {
    console.warn(`[email:stub:bulk] "${input.subject}" → ${input.to.email} (${input.to.locale})`);
    return;
  }

  throw new Error(
    "sendBulkEmail: Brevo bulk-integrasjon ikke implementert ennå. Se TODO i src/lib/email/send.ts."
  );
}
