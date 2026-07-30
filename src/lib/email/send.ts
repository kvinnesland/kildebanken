import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { renderMagicLinkEmail } from "./templates/magic-link";
import { renderConfirmEmailEmail } from "./templates/confirm-email";
import { renderJournalistApplicationReceivedEmail } from "./templates/journalist-application-received";
import { renderJournalistApprovedEmail } from "./templates/journalist-approved";
import { renderJournalistRejectedEmail } from "./templates/journalist-rejected";
import { renderResponseSubmittedReceiptEmail } from "./templates/response-submitted-receipt";
import { renderNewResponseReceivedEmail } from "./templates/new-response-received";
import { renderConfirmAccountDeletionEmail } from "./templates/confirm-account-deletion";
import { renderAccountDeletionConfirmedEmail } from "./templates/account-deletion-confirmed";
import { renderContactRequestReceivedEmail } from "./templates/contact-request-received";
import { renderContactApprovedEmail } from "./templates/contact-approved";
import { renderContactDeclinedEmail } from "./templates/contact-declined";
import { renderRequestClosedEmail } from "./templates/request-closed";
import { renderRequestApprovedPublishedEmail } from "./templates/request-approved-published";
import { renderChangesRequestedEmail } from "./templates/changes-requested";
import { renderRequestRejectedEmail } from "./templates/request-rejected";
import { renderDeadlineApproaching24hEmail } from "./templates/deadline-approaching-24h";
import { renderStaleRequestReminder30dEmail } from "./templates/stale-request-reminder-30d";
import { renderResponseRequestClosedEmail } from "./templates/response-request-closed";
import { renderNewRequestForModerationEmail } from "./templates/new-request-for-moderation";
import { renderContentReportedEmail } from "./templates/content-reported";
import { renderContactRequestCancelledAccountDeletedEmail } from "./templates/contact-request-cancelled-account-deleted";
import { renderLegalTermsMaterialChangeEmail } from "./templates/legal-terms-material-change";
import type { RenderedEmail } from "./templates/simple-cta-email";

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

/**
 * Rendrer den faktiske mal-HTML-en/-teksten for ALLE 23 malene i
 * `TransactionalTemplate` (fullført økt 7, se NATTLOGG.md).
 * `null` betyr "ingen mal bygget ennå for denne, ELLER dataene som kreves
 * mangler", ikke en feil — stubben under faller da tilbake til det gamle,
 * generiske loggformatet. Grenene sjekker BARE de feltene sin egen mal
 * faktisk trenger, ikke en felles "token"-forutsetning for alle — svar-
 * malene bruker `requestId`/`requestTitle` (og `requestSlug` for den som
 * lenker til den offentlige siden), ikke `token`.
 */
function renderTransactionalEmail(input: SendTransactionalEmailInput): RenderedEmail | null {
  const locale = isSupportedLocale(input.to.locale) ? input.to.locale : PLATFORM_DEFAULT_LOCALE;

  switch (input.template) {
    case "magic_link":
    case "confirm_email":
    case "journalist_application_received":
    case "confirm_account_deletion": {
      const token = input.data.token;
      if (typeof token !== "string") return null;
      if (input.template === "magic_link") return renderMagicLinkEmail(locale, token);
      if (input.template === "confirm_email") return renderConfirmEmailEmail(locale, token);
      if (input.template === "journalist_application_received") {
        return renderJournalistApplicationReceivedEmail(locale, token);
      }
      return renderConfirmAccountDeletionEmail(locale, token);
    }
    case "journalist_approved":
    case "account_deletion_confirmed":
      return input.template === "journalist_approved"
        ? renderJournalistApprovedEmail(locale)
        : renderAccountDeletionConfirmedEmail(locale);
    case "journalist_rejected": {
      const reason = input.data.reason;
      if (typeof reason !== "string") return null;
      return renderJournalistRejectedEmail(locale, reason);
    }
    case "response_submitted_receipt": {
      const { requestId, requestTitle, requestSlug } = input.data;
      if (
        typeof requestId !== "string" ||
        typeof requestTitle !== "string" ||
        typeof requestSlug !== "string"
      ) {
        return null;
      }
      return renderResponseSubmittedReceiptEmail(locale, requestId, requestTitle, requestSlug);
    }
    case "new_response_received": {
      const { requestId, requestTitle } = input.data;
      if (typeof requestId !== "string" || typeof requestTitle !== "string") return null;
      return renderNewResponseReceivedEmail(locale, requestId, requestTitle);
    }
    case "contact_request_received": {
      const { contactRequestId, requestTitle, journalistName, organizationName } = input.data;
      if (
        typeof contactRequestId !== "string" ||
        typeof requestTitle !== "string" ||
        typeof journalistName !== "string" ||
        typeof organizationName !== "string"
      ) {
        return null;
      }
      return renderContactRequestReceivedEmail(
        locale,
        contactRequestId,
        requestTitle,
        journalistName,
        organizationName
      );
    }
    case "contact_approved": {
      const contactRequestId = input.data.contactRequestId;
      if (typeof contactRequestId !== "string") return null;
      return renderContactApprovedEmail(locale, contactRequestId);
    }
    case "contact_declined":
      return renderContactDeclinedEmail(locale);
    case "request_closed": {
      const { requestId, title } = input.data;
      if (typeof requestId !== "string" || typeof title !== "string") return null;
      return renderRequestClosedEmail(locale, requestId, title);
    }
    case "request_approved_published": {
      const { requestId, title, slug } = input.data;
      if (typeof requestId !== "string" || typeof title !== "string" || typeof slug !== "string") {
        return null;
      }
      return renderRequestApprovedPublishedEmail(locale, requestId, title, slug);
    }
    case "changes_requested": {
      const { requestId, comment } = input.data;
      if (typeof requestId !== "string" || typeof comment !== "string") return null;
      return renderChangesRequestedEmail(locale, requestId, comment);
    }
    case "request_rejected": {
      const reason = input.data.reason;
      if (typeof reason !== "string") return null;
      return renderRequestRejectedEmail(locale, reason);
    }
    case "deadline_approaching_24h": {
      const { requestId, title } = input.data;
      if (typeof requestId !== "string" || typeof title !== "string") return null;
      return renderDeadlineApproaching24hEmail(locale, requestId, title);
    }
    case "stale_request_reminder_30d": {
      const { requestId, title } = input.data;
      if (typeof requestId !== "string" || typeof title !== "string") return null;
      return renderStaleRequestReminder30dEmail(locale, requestId, title);
    }
    case "response_request_closed": {
      const { requestId, title, slug } = input.data;
      if (typeof requestId !== "string" || typeof title !== "string" || typeof slug !== "string") {
        return null;
      }
      return renderResponseRequestClosedEmail(locale, requestId, title, slug);
    }
    case "new_request_for_moderation": {
      const title = input.data.title;
      if (typeof title !== "string") return null;
      return renderNewRequestForModerationEmail(locale, title);
    }
    case "content_reported": {
      const { entityType, reason, comment } = input.data;
      if (
        (entityType !== "request" && entityType !== "response") ||
        typeof reason !== "string" ||
        typeof comment !== "string"
      ) {
        return null;
      }
      return renderContentReportedEmail(locale, entityType, reason, comment);
    }
    case "contact_request_cancelled_account_deleted":
      return renderContactRequestCancelledAccountDeletedEmail(locale);
    case "legal_terms_material_change": {
      const { documentType, countryCode } = input.data;
      if (
        (documentType !== "terms" && documentType !== "privacy") ||
        typeof countryCode !== "string"
      ) {
        return null;
      }
      return renderLegalTermsMaterialChangeEmail(locale, documentType, countryCode);
    }
    default:
      return null;
  }
}

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput
): Promise<void> {
  if (!process.env.BREVO_API_KEY) {
    const rendered = renderTransactionalEmail(input);
    if (rendered) {
      console.warn(
        `[email:stub] ${input.template} → ${input.to.email} (${input.to.locale}) — "${rendered.subject}"\n${rendered.text}`
      );
    } else {
      console.warn(
        `[email:stub] ${input.template} → ${input.to.email} (${input.to.locale})`,
        input.data
      );
    }
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
  // FR-038: "Alle bulkutsendelser skal inneholde List-Unsubscribe og
  // List-Unsubscribe-Post." Obligatorisk (ikke valgfritt) med hensikt — et
  // glemt felt skal gi en typefeil, ikke en bulk-e-post uten headeren.
  // Peker på API-RUTEN direkte (/api/unsubscribe/:token), IKKE
  // frontend-siden lenken i selve e-postteksten peker til
  // (src/lib/email/digest.ts) — e-postklienten POSTer rett til denne uten å
  // rendre noen side (RFC 8058, "one-click").
  listUnsubscribeUrl: string;
}

/**
 * Egen funksjon for den daglige digesten — atskilt fra
 * `sendTransactionalEmail` med hensikt (`INFRASTRUCTURE.md` 6.1: "atskilte
 * strømmer for transaksjonell e-post og bulk, slik at en klage på digesten
 * ikke ødelegger leveringen av innloggingslenker"). Når Brevo faktisk kobles
 * til, skal denne bruke bulk-/kampanje-API-et, ikke det transaksjonelle, OG
 * sende med `List-Unsubscribe: <listUnsubscribeUrl>` og
 * `List-Unsubscribe-Post: List-Unsubscribe=One-Click` som ekte e-post-
 * headere (FR-038) — ikke implementert ennå siden selve Brevo-kallet ikke
 * er bygget, men feltet finnes allerede i grensesnittet slik at det ikke
 * glemmes når det bygges.
 */
export async function sendBulkEmail(input: SendBulkEmailInput): Promise<void> {
  if (!process.env.BREVO_API_KEY) {
    console.warn(
      `[email:stub:bulk] "${input.subject}" → ${input.to.email} (${input.to.locale}) ` +
        `[List-Unsubscribe: ${input.listUnsubscribeUrl}]`
    );
    return;
  }

  throw new Error(
    "sendBulkEmail: Brevo bulk-integrasjon ikke implementert ennå. Se TODO i src/lib/email/send.ts."
  );
}
