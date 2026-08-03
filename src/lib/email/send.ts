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
// Brevo-kallet bruker rå `fetch` mot v3/smtp/email (dokumentert, stabilt
// API), IKKE Brevo sitt Node-SDK — unngår en avhengighet for tre HTTP-kall.
// Endepunktet, autentiseringsheaderen (`api-key`), request-feltnavnene
// (`sender`, `to`, `subject`, `htmlContent`, `textContent`, `headers`,
// inkludert `List-Unsubscribe`/`List-Unsubscribe-Post`s eksakte verdiform)
// og responsfeltet (`messageId`) er bekreftet mot Brevos offentlige
// dokumentasjon (økt 12, se NATTLOGG.md — samme metode som webhook-
// verifiseringen i src/app/api/webhooks/email-events/route.ts:
// developers.brevo.com avviser WebFetch med 403, men uavhengige kilder via
// WebSearch stemte overens på alle punkter). INGEN avvik funnet her, ulikt
// webhook-siden. Fortsatt ingen ekte testsending gjort (ingen API-nøkkel
// tilgjengelig i dette miljøet) — anbefales likevel før produksjon, som en
// siste bekreftelse mot en faktisk konto. Malnavnene under er de eksakte
// navnene fra SPEC-V1.md 15 og må ikke endres uten å oppdatere spec-en
// samtidig.
const BREVO_SEND_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

interface BrevoEmailPayload {
  sender: { email: string; name?: string };
  to: [{ email: string }];
  subject: string;
  htmlContent: string;
  textContent: string;
  headers?: Record<string, string>;
  replyTo?: { email: string };
}

/**
 * Returnerer Brevo sin egen `messageId` fra svarkroppen (`{"messageId":
 * "<...>"}` i deres dokumenterte v3/smtp/email-respons, bekreftet — se
 * filkommentaren øverst) — brukes til å koble en senere webhook-hendelse
 * (bounce/klage/levert) tilbake til nøyaktig denne utsendelsen, se
 * `DigestDelivery.provider_message_id` (SPEC-V1.md 19.10) og
 * `src/lib/subscriptions/email-events.ts`. `null` ved manglende eller
 * ikke-parsbart felt — en defensiv fallback for et uventet svar, ikke et
 * tegn på at feltnavnet selv er usikkert, og en `null` her skal aldri
 * stoppe selve sendingen.
 */
function extractBrevoMessageId(rawBody: string): string | null {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (parsed && typeof parsed === "object" && "messageId" in parsed) {
      const messageId = (parsed as { messageId: unknown }).messageId;
      if (typeof messageId === "string") return messageId;
    }
  } catch {
    // Ikke-parsbar kropp — behandles som "ingen ID", ikke en feil.
  }
  return null;
}

async function sendViaBrevo(apiKey: string, payload: BrevoEmailPayload): Promise<string | null> {
  const response = await fetch(BREVO_SEND_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`Brevo-sending feilet (${response.status}): ${body}`);
  }
  return extractBrevoMessageId(body);
}

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
      const { title, reason } = input.data;
      if (typeof title !== "string" || typeof reason !== "string") return null;
      return renderRequestRejectedEmail(locale, title, reason);
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
      const { entityType, entityId, reason, comment } = input.data;
      if (
        (entityType !== "request" && entityType !== "response") ||
        typeof entityId !== "string" ||
        typeof reason !== "string" ||
        typeof comment !== "string"
      ) {
        return null;
      }
      return renderContentReportedEmail(locale, entityType, entityId, reason, comment);
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
  const apiKey = process.env.BREVO_API_KEY;
  const rendered = renderTransactionalEmail(input);

  if (!apiKey) {
    // INFRASTRUCTURE.md 10: "Personopplysninger logges ikke: ingen
    // e-postadresser" — stubb-loggingen under skriver nettopp
    // mottakerens e-postadresse, og er ment KUN som en utviklingsbekvemmelighet
    // for lokal kjøring/tester uten en ekte Brevo-nøkkel (se resten av denne
    // funksjonen, og de mange testene i send.test.ts som forutsetter nettopp
    // dette). Uten denne sperren ville en glemt/feilkonfigurert
    // `BREVO_API_KEY` i en EKTE driftsatt miljø stille degradert til å skrive
    // brukeres e-postadresser til logg i stedet for å feile høylytt.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "sendTransactionalEmail: BREVO_API_KEY mangler i produksjon — nekter å falle tilbake til stubb-logging (ville skrevet mottakerens e-postadresse til logg, se INFRASTRUCTURE.md 10)."
      );
    }
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

  if (!rendered) {
    throw new Error(
      `sendTransactionalEmail: ingen mal bygget for "${input.template}", eller data mangler et felt malen krever.`
    );
  }

  const senderEmail = process.env.BREVO_SENDER_TRANSACTIONAL;
  if (!senderEmail) {
    throw new Error("sendTransactionalEmail: BREVO_SENDER_TRANSACTIONAL er ikke satt i miljøet.");
  }

  // Transaksjonell e-post har ingen tabell for per-utsendelse-status (bare
  // digest-utsendelser har DigestDelivery) — meldings-IDen fra Brevo har
  // derfor ingen sted å lagres her, og forkastes med hensikt.
  await sendViaBrevo(apiKey, {
    sender: { email: senderEmail },
    to: [{ email: input.to.email }],
    subject: rendered.subject,
    htmlContent: rendered.html,
    textContent: rendered.text,
  });
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
  // SPEC-V1.md 10.4: "From-navnet lokaliseres per land og språk via
  // sender_name_key, og Reply-To settes til landets support_email." Reelt
  // hull frem til nå (se NATTLOGG.md): `countries.senderNameKey` og
  // `countries.supportEmail` ble lagret og administrert i admin-UI-et, men
  // ALDRI faktisk lest av selve sendekoden — hver digest gikk ut med bare
  // den rå avsender-e-postadressen som synlig navn, og uten noen Reply-To i
  // det hele tatt. Begge obligatoriske, samme begrunnelse som
  // `listUnsubscribeUrl` over.
  senderName: string;
  replyTo: string;
}

/**
 * Egen funksjon for den daglige digesten — atskilt fra
 * `sendTransactionalEmail` med hensikt (`INFRASTRUCTURE.md` 6.1: "atskilte
 * strømmer for transaksjonell e-post og bulk, slik at en klage på digesten
 * ikke ødelegger leveringen av innloggingslenker"). Bruker det SAMME
 * `v3/smtp/email`-endepunktet som `sendTransactionalEmail` — ikke Brevo sitt
 * separate kampanje-/liste-API, som er bygget for maler mot kontaktlister,
 * ikke for individuelt rendret innhold per mottaker (hver digest er allerede
 * unik per mottaker, se src/lib/email/digest.ts). Atskillelsen ligger i
 * `BREVO_SENDER_BULK` (eget avsenderdomene, INFRASTRUCTURE.md 6.3) og i
 * `List-Unsubscribe`/`List-Unsubscribe-Post`-headerne (FR-038), ikke i et
 * annet API-produkt.
 *
 * Returnerer Brevo sin `messageId` (eller `null` i stubb-modus/ved manglende
 * felt) — kalleren (src/lib/jobs/tick.ts, src/lib/digests/digests.ts) lagrer
 * denne på den tilhørende `DigestDelivery`-raden, se `extractBrevoMessageId()`
 * over for hvorfor dette er nødvendig for 16.2s "bounces, klager"-visning.
 */
export async function sendBulkEmail(input: SendBulkEmailInput): Promise<string | null> {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    // Se samme sperre og begrunnelse i sendTransactionalEmail() over.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "sendBulkEmail: BREVO_API_KEY mangler i produksjon — nekter å falle tilbake til stubb-logging (ville skrevet mottakerens e-postadresse til logg, se INFRASTRUCTURE.md 10)."
      );
    }
    console.warn(
      `[email:stub:bulk] "${input.subject}" → ${input.to.email} (${input.to.locale}) ` +
        `[List-Unsubscribe: ${input.listUnsubscribeUrl}]`
    );
    return null;
  }

  const senderEmail = process.env.BREVO_SENDER_BULK;
  if (!senderEmail) {
    throw new Error("sendBulkEmail: BREVO_SENDER_BULK er ikke satt i miljøet.");
  }

  return sendViaBrevo(apiKey, {
    sender: { email: senderEmail, name: input.senderName },
    to: [{ email: input.to.email }],
    subject: input.subject,
    htmlContent: input.html,
    textContent: input.text,
    replyTo: { email: input.replyTo },
    headers: {
      "List-Unsubscribe": `<${input.listUnsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}
