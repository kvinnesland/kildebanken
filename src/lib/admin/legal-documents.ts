import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLogs,
  countries,
  emailSubscriptions,
  legalDocuments,
  legalDocumentType,
  users,
} from "@/db/schema";
import { isUniqueViolation } from "@/db/errors";
import { sendTransactionalEmail } from "@/lib/email/send";
import { resolveSenderIdentity } from "@/lib/email/sender-identity";
import { requireAdmin } from "@/lib/auth/authorize";

export interface LegalDocumentSummary {
  id: string;
  locale: string;
  documentType: (typeof legalDocumentType.enumValues)[number];
  version: string;
  publishedAt: Date;
  isMaterialChange: boolean;
}

export type ListLegalDocumentsResult =
  | { ok: true; documents: LegalDocumentSummary[] }
  | { ok: false; error: string };

/**
 * GET-siden av admin/land-siden (natt til 2026-08-01, se NATTLOGG.md) —
 * 16.2 sier "publisere NYE versjoner", men en admin-UI kan ikke ta et
 * informert publiseringsvalg uten å først se hvilke versjoner som
 * allerede finnes per (locale, dokumenttype). Ingen skriving her, bare
 * lesing — samme `requireAdmin()`-gate som resten av denne filen.
 * Returnerer ALLE versjoner (ikke bare gjeldende, i motsetning til
 * `getCurrentLegalDocument()` i src/lib/legal/documents.ts) — 17.2 sier
 * eksplisitt at gamle versjoner "beholdes uendret", og en administrator
 * som vurderer en ny publisering bør se HELE historikken, ikke bare det
 * som er gjeldende akkurat nå.
 */
export async function listLegalDocumentsForCountry(countryCode: string): Promise<ListLegalDocumentsResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "errors.not_authorized" };

  const documents = await db
    .select({
      id: legalDocuments.id,
      locale: legalDocuments.locale,
      documentType: legalDocuments.documentType,
      version: legalDocuments.version,
      publishedAt: legalDocuments.publishedAt,
      isMaterialChange: legalDocuments.isMaterialChange,
    })
    .from(legalDocuments)
    .where(eq(legalDocuments.countryCode, countryCode))
    .orderBy(desc(legalDocuments.publishedAt));

  return { ok: true, documents };
}

export interface PublishLegalDocumentInput {
  countryCode: string;
  locale: string;
  documentType: (typeof legalDocumentType.enumValues)[number];
  version: string;
  body: string;
  isMaterialChange: boolean;
}

export type PublishLegalDocumentResult = { ok: true } | { ok: false; error: string };

/**
 * POST /admin/legal-documents (SPEC-V1.md 16.2, 17.2, 19.2). Publiserer en
 * NY versjon — eksisterende versjoner endres aldri (17.2: "beholdes uendret
 * så lenge det finnes et samtykke som viser til den").
 *
 * 17.2: "Ved vesentlig endring i et dokument varsles alle berørte brukere i
 * det landet på sitt eget språk." Implementert her for `terms`/`privacy` →
 * aktive mottakere i landet, i NØYAKTIG den locale-en dokumentet gjelder
 * (dermed "på sitt eget språk" per konstruksjon — en annen locales egen
 * oppdatering varsler separat). Malen `legal_terms_material_change`
 * (seksjon 15) er skrevet for "mottaker" — varsling ved en
 * `journalist_terms`-endring er IKKE bygget her, en bevisst avgrenset
 * antagelse (se NATTLOGG.md), ikke en beslutning om at det ikke trengs.
 * "Et nytt samtykke innhentes der endringen krever det" (samme setning) er
 * heller ikke bygget som en tvungen re-samtykke-sperre i v1 — spec-en sier
 * ikke NÅR/HVORDAN det skal håndheves (ved neste innlogging? en
 * blokkerende banner?), og å finne opp den UX-en her uten videre grunnlag i
 * spec-en er en for stor antagelse å ta stille.
 */
export async function publishLegalDocument(
  input: PublishLegalDocumentInput
): Promise<PublishLegalDocumentResult> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: "errors.not_authorized" };

  if (!input.body.trim() || !input.version.trim()) {
    return { ok: false, error: "errors.validation_failed" };
  }

  const [country] = await db
    .select({ code: countries.code })
    .from(countries)
    .where(eq(countries.code, input.countryCode))
    .limit(1);
  if (!country) return { ok: false, error: "errors.invalid_country" };

  // Ingen forhåndssjekk her (i motsetning til createCountry() e.l.) — den
  // unike indeksen (countryCode, locale, documentType, version,
  // legal_documents_country_locale_type_version_idx) er selve garantien mot
  // dobbel publisering av samme versjon, f.eks. en administrator som
  // dobbeltklikker "Publiser". Uten fangst her ville det andre kallet
  // krasjet med en uhåndtert 23505 i stedet for en forventet
  // errors.already_exists — samme bug-klasse som createCountry() (se
  // NATTLOGG.md).
  let published: { id: string } | undefined;
  try {
    [published] = await db
      .insert(legalDocuments)
      .values({
        countryCode: input.countryCode,
        locale: input.locale,
        documentType: input.documentType,
        version: input.version,
        body: input.body,
        isMaterialChange: input.isMaterialChange,
        publishedAt: new Date(),
      })
      .returning({ id: legalDocuments.id });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "errors.already_exists" };
    }
    throw err;
  }
  if (!published) throw new Error("insert av juridisk dokument returnerte ingen rad");

  // FR-050. Manglet frem til nå — samme klasse av hull som resten av
  // src/lib/admin/ (se NATTLOGG.md, økt 7).
  await db.insert(auditLogs).values({
    actorType: "user",
    actorUserId: session.userId,
    countryCode: input.countryCode,
    action: "legal_document.publish",
    entityType: "legal_document",
    entityId: published.id,
    metadata: { documentType: input.documentType, version: input.version, locale: input.locale },
  });

  if (input.isMaterialChange && (input.documentType === "terms" || input.documentType === "privacy")) {
    const affectedRecipients = await db
      .select({ email: users.email, locale: users.locale })
      .from(users)
      .innerJoin(emailSubscriptions, eq(emailSubscriptions.userId, users.id))
      .where(
        and(
          eq(users.role, "recipient"),
          eq(users.status, "active"),
          eq(users.countryCode, input.countryCode),
          eq(users.locale, input.locale)
        )
      );

    // SPEC-V1.md 10.4 — se resolveSenderIdentity() sin egen kommentar. Hentet
    // ÉN gang utenfor loopen: WHERE-betingelsen over sikrer at ALLE
    // affectedRecipients deler samme countryCode/locale (input.countryCode,
    // input.locale), så identiteten er identisk for hele batchen.
    const identity = await resolveSenderIdentity(input.countryCode, input.locale);
    for (const recipient of affectedRecipients) {
      await sendTransactionalEmail({
        template: "legal_terms_material_change",
        to: { email: recipient.email, locale: recipient.locale },
        data: { documentType: input.documentType, countryCode: input.countryCode },
        senderName: identity?.senderName,
        replyTo: identity?.replyTo,
        countryDefaultLocale: identity?.countryDefaultLocale,
      });
    }
  }

  return { ok: true };
}
