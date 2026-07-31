// Datamodell — oversatt felt for felt fra SPEC-V1.md seksjon 19.
// Enhver avvikelse fra spec-en her er en feil i denne filen, ikke et
// alternativt forslag. Endre spec-en først, deretter dette.
//
// Seksten tabeller. AuthToken og Session (19.14–19.15) ble lagt til i spec-en
// under autonomt arbeid, økt 2 — se NATTLOGG.md.

import {
  pgTable,
  pgEnum,
  text,
  uuid,
  timestamp,
  boolean,
  integer,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const countryStatus = pgEnum("country_status", [
  "draft",
  "active",
  "paused",
]);

export const legalDocumentType = pgEnum("legal_document_type", [
  "terms",
  "privacy",
  "journalist_terms",
]);

export const userRole = pgEnum("user_role", [
  "recipient",
  "journalist",
  "moderator",
  "admin",
]);

export const userStatus = pgEnum("user_status", [
  "pending_email_verification",
  "active",
  "suspended",
  "deleted",
]);

export const requestStatus = pgEnum("request_status", [
  "draft",
  "submitted",
  "changes_requested",
  "published",
  "closed",
  "expired",
  "rejected",
  "deleted",
]);

export const responseLifecycleStatus = pgEnum("response_lifecycle_status", [
  "submitted",
  "withdrawn",
  "hidden_by_moderator",
  "deleted",
]);

export const responseJournalistMarking = pgEnum("response_journalist_marking", [
  "unreviewed",
  "shortlisted",
  "not_selected",
]);

export const contactSharing = pgEnum("contact_sharing", ["none", "email"]);

export const contactRequestStatus = pgEnum("contact_request_status", [
  "pending",
  "approved",
  "declined",
  "expired",
  "cancelled",
]);

export const emailSubscriptionStatus = pgEnum("email_subscription_status", [
  "active",
  "unsubscribed",
  "bounced",
]);

export const digestStatus = pgEnum("digest_status", [
  "pending",
  "sending",
  "sent",
  "failed",
]);

export const digestDeliveryStatus = pgEnum("digest_delivery_status", [
  "queued",
  "sent",
  "delivered",
  "bounced",
  "complained",
  "failed",
]);

export const consentType = pgEnum("consent_type", [
  "terms",
  "privacy",
  "journalist_terms",
  "email_subscription",
  "minimum_age",
]);

export const consentSource = pgEnum("consent_source", [
  "registration_form",
  "settings_page",
  "unsubscribe_link",
  "country_change",
  "document_update",
]);

export const auditActorType = pgEnum("audit_actor_type", [
  "user",
  "system",
  "job",
]);

export const suppressionReason = pgEnum("suppression_reason", [
  "unsubscribed",
  "hard_bounce",
  "complaint",
  "manual",
]);

export const authTokenPurpose = pgEnum("auth_token_purpose", [
  "login",
  "delete_account",
  "data_export",
]);

export const journalistVerificationStatus = pgEnum("journalist_verification_status", [
  "pending_review",
  "approved",
  "rejected",
]);

// ---------------------------------------------------------------------------
// 19.1 Country
// ---------------------------------------------------------------------------

export const countries = pgTable("countries", {
  code: text("code").primaryKey(), // ISO 3166-1 alpha-2
  nameKey: text("name_key").notNull(),
  defaultLocale: text("default_locale").notNull(), // BCP-47
  availableLocales: text("available_locales").array().notNull(),
  timezone: text("timezone").notNull(), // IANA
  minimumAge: integer("minimum_age").notNull(),
  digestSendTime: text("digest_send_time").notNull(), // "HH:MM" i landets tidssone
  senderNameKey: text("sender_name_key").notNull(),
  supportEmail: text("support_email").notNull(),
  status: countryStatus("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 19.2 LegalDocument
// ---------------------------------------------------------------------------

export const legalDocuments = pgTable(
  "legal_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    countryCode: text("country_code")
      .notNull()
      .references(() => countries.code),
    locale: text("locale").notNull(),
    documentType: legalDocumentType("document_type").notNull(),
    version: text("version").notNull(), // semantisk, monotont økende per (land, type)
    body: text("body").notNull(), // eller referanse til versjonert fil i repoet
    isMaterialChange: boolean("is_material_change").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("legal_documents_country_locale_type_version_idx").on(
      t.countryCode,
      t.locale,
      t.documentType,
      t.version
    ),
  ]
);

// ---------------------------------------------------------------------------
// 19.3 User
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  emailHash: text("email_hash"), // settes ved anonymisering
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  role: userRole("role").notNull(),
  status: userStatus("status").notNull().default("pending_email_verification"),
  countryCode: text("country_code")
    .notNull()
    .references(() => countries.code),
  locale: text("locale").notNull(),
  timezone: text("timezone"), // nullable — arver landets tidssone når tom
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// 19.4 ModeratorCountry — sammensatt primærnøkkel, administrator har ingen rader
// ---------------------------------------------------------------------------

export const moderatorCountries = pgTable(
  "moderator_countries",
  {
    moderatorUserId: uuid("moderator_user_id")
      .notNull()
      .references(() => users.id),
    countryCode: text("country_code")
      .notNull()
      .references(() => countries.code),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.moderatorUserId, t.countryCode] })]
);

// ---------------------------------------------------------------------------
// 19.5 JournalistProfile — landet ligger på users.country_code
// ---------------------------------------------------------------------------

export const journalistProfiles = pgTable("journalist_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id),
  fullName: text("full_name").notNull(),
  jobTitle: text("job_title").notNull(),
  organizationName: text("organization_name").notNull(),
  organizationUrl: text("organization_url").notNull(),
  // Atskilt fra User.status med hensikt — se SPEC-V1.md 8.1 (rettet økt 3).
  verificationStatus: journalistVerificationStatus("verification_status")
    .notNull()
    .default("pending_review"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNote: text("review_note"), // kun synlig for moderator
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 19.6 Request
// ---------------------------------------------------------------------------

export const requests = pgTable(
  "requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    journalistId: uuid("journalist_id").notNull().references(() => users.id),
    // Kopiert bevisst fra journalisten ved opprettelse — se SPEC-V1.md 19.6.
    countryCode: text("country_code").notNull().references(() => countries.code),
    contentLanguage: text("content_language").notNull(), // BCP-47 — satt ved opprettelse, aldri tom
    // De åtte feltene under er nullable INNTIL INNSENDING (FR-020/FR-021) —
    // "obligatorisk" i 9.1 betyr obligatorisk for å sende til moderering,
    // ikke i databasen fra opprettelsen. Se SPEC-V1.md 19.6, rettet økt 6.
    slug: text("slug"),
    title: text("title"),
    summary: text("summary"),
    description: text("description"),
    targetPersonDescription: text("target_person_description"),
    topic: text("topic"), // fast nøkkel, aldri en visningsstreng
    geographicNote: text("geographic_note"),
    internalReference: text("internal_reference"),
    responseDeadline: timestamp("response_deadline", { withTimezone: true }),
    status: requestStatus("status").notNull().default("draft"),
    // Boolsk + nullable med hensikt: "ikke besvart ennå" i et utkast skal
    // aldri stille bli tolket som `false` (en NOT NULL DEFAULT false ville
    // skjult at journalisten aldri tok stilling).
    allowsAnonymousParticipation: boolean("allows_anonymous_participation"),
    mayBeRecorded: boolean("may_be_recorded"),
    mayInvolvePhotoVideo: boolean("may_involve_photo_video"),
    moderatorComment: text("moderator_comment"),
    moderatedBy: uuid("moderated_by").references(() => users.id),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    includedInDigestAt: timestamp("included_in_digest_at", { withTimezone: true }),
    // Settes ved BÅDE closed og expired — se SPEC-V1.md 9.2.
    closedAt: timestamp("closed_at", { withTimezone: true }),
    // Idempotens-flagg for jobbene i INFRASTRUCTURE.md 5.1 — uten disse
    // sendes samme påminnelse på nytt hvert 15. minutt innenfor tidsvinduet.
    deadlineReminderSentAt: timestamp("deadline_reminder_sent_at", { withTimezone: true }),
    staleReminderSentAt: timestamp("stale_reminder_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("requests_slug_idx").on(t.slug),
    index("requests_country_status_idx").on(t.countryCode, t.status),
    // Støtter FR-029 (maks 5 samtidig publiserte per journalist, SPEC-V1.md 9.2).
    index("requests_journalist_status_idx").on(t.journalistId, t.status),
  ]
);

// ---------------------------------------------------------------------------
// 19.7 Response
// ---------------------------------------------------------------------------

export const responses = pgTable(
  "responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull().references(() => requests.id),
    respondentId: uuid("respondent_id").notNull().references(() => users.id),
    displayNameSnapshot: text("display_name_snapshot"),
    relevanceStatement: text("relevance_statement").notNull(),
    answerText: text("answer_text").notNull(),
    shortBio: text("short_bio"),
    contactSharing: contactSharing("contact_sharing").notNull().default("none"),
    lifecycleStatus: responseLifecycleStatus("lifecycle_status")
      .notNull()
      .default("submitted"),
    journalistMarking: responseJournalistMarking("journalist_marking")
      .notNull()
      .default("unreviewed"),
    journalistNote: text("journalist_note"),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // FR-041 (ett aktivt svar per person per forespørsel) håndheves av en
    // betinget unik indeks Drizzle ikke kan uttrykke i schema-API-et — se
    // src/db/migrations/0001_responses_active_unique_index.sql.
    index("responses_request_id_idx").on(t.requestId),
    index("responses_respondent_id_idx").on(t.respondentId),
  ]
);

// ---------------------------------------------------------------------------
// 19.8 ContactRequest
// ---------------------------------------------------------------------------

export const contactRequests = pgTable("contact_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Nullable med hensikt (rettet økt 6, se SPEC-V1.md 19.8): svaret slettes
  // umiddelbart ved trekking (17.4), mens kontaktforespørselen har sin egen,
  // uavhengige retensjonstid og skal overleve den slettingen.
  responseId: uuid("response_id").unique().references(() => responses.id),
  journalistId: uuid("journalist_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  requestedContactMethod: text("requested_contact_method").notNull(),
  status: contactRequestStatus("status").notNull().default("pending"),
  sharedEmail: text("shared_email"),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 19.9 EmailSubscription — landet ligger på brukeren
// ---------------------------------------------------------------------------

export const emailSubscriptions = pgTable("email_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id),
  status: emailSubscriptionStatus("status").notNull().default("active"),
  unsubscribeTokenHash: text("unsubscribe_token_hash").notNull(),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  lastDigestAt: timestamp("last_digest_at", { withTimezone: true }),
  // 10.3: "tre myke bounces på rad behandles som hard bounce" — lagt til
  // under autonomt arbeid (økt 7, se NATTLOGG.md og SPEC-V1.md 19.9), siden
  // datamodellen ikke hadde noen måte å telle dem på.
  consecutiveSoftBounces: integer("consecutive_soft_bounces").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 19.10 Digest og DigestDelivery
// ---------------------------------------------------------------------------

export const digests = pgTable(
  "digests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    countryCode: text("country_code").notNull().references(() => countries.code),
    scheduledFor: text("scheduled_for").notNull(), // lokal_dato, "YYYY-MM-DD" i landets tidssone
    requestIds: uuid("request_ids").array().notNull(),
    recipientCount: integer("recipient_count").notNull().default(0),
    status: digestStatus("status").notNull().default("pending"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Bærer idempotensen i INFRASTRUCTURE.md 5.2 — to overlappende tikk kan
    // ikke gi to digester for samme (land, lokal dato).
    uniqueIndex("digests_country_scheduled_for_idx").on(t.countryCode, t.scheduledFor),
  ]
);

export const digestDeliveries = pgTable(
  "digest_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    digestId: uuid("digest_id").notNull().references(() => digests.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    locale: text("locale").notNull(),
    accessTokenHash: text("access_token_hash").notNull(),
    providerMessageId: text("provider_message_id"),
    status: digestDeliveryStatus("status").notNull().default("queued"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("digest_deliveries_digest_user_idx").on(t.digestId, t.userId),
  ]
);

// ---------------------------------------------------------------------------
// 19.11 ConsentRecord
// ---------------------------------------------------------------------------

export const consentRecords = pgTable("consent_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  consentType: consentType("consent_type").notNull(),
  legalDocumentId: uuid("legal_document_id").references(() => legalDocuments.id),
  countryCode: text("country_code").notNull().references(() => countries.code),
  locale: text("locale").notNull(),
  granted: boolean("granted").notNull(),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  source: consentSource("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 19.12 AuditLog
// ---------------------------------------------------------------------------

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorType: auditActorType("actor_type").notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id), // null for system/job
  countryCode: text("country_code").references(() => countries.code),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  reason: text("reason"), // obligatorisk (håndheves i applikasjonslaget) ved oppslag i svar
  // Aldri fullstendige svar eller unødvendige personopplysninger — se SPEC-V1.md 19.12.
  metadata: jsonb("metadata"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 19.13 Suppression — global på tvers av land
// ---------------------------------------------------------------------------

export const suppressions = pgTable("suppressions", {
  id: uuid("id").primaryKey().defaultRandom(),
  emailHash: text("email_hash").notNull().unique(),
  reason: suppressionReason("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 19.14 AuthToken — engangstoken for magic link (SPEC-V1.md 6.1, 24.3)
// ---------------------------------------------------------------------------

export const authTokens = pgTable("auth_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  purpose: authTokenPurpose("purpose").notNull().default("login"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 19.15 Session — SPEC-V1.md 6.1 (30 dager, fornyes ved bruk) / 6.3 (12
// timer for moderator/administrator, ingen fornyelse)
// ---------------------------------------------------------------------------

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 19.16 RateLimitHit — SPEC-V1.md 18 (rate limiting: 5 innloggingsforespørsler
// per adresse per 15 min, 10 svarinnsendinger per konto per time, 20
// forespørselsopprettelser per journalist per døgn). Ett generisk
// tellevindu for alle grensene, se src/lib/security/rate-limit.ts.
// ---------------------------------------------------------------------------

export const rateLimitHits = pgTable(
  "rate_limit_hits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bucket: text("bucket").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    bucketCreatedAtIdx: index("rate_limit_hits_bucket_created_at_idx").on(
      table.bucket,
      table.createdAt
    ),
  })
);
