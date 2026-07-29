CREATE TYPE "public"."audit_actor_type" AS ENUM('user', 'system', 'job');--> statement-breakpoint
CREATE TYPE "public"."auth_token_purpose" AS ENUM('login', 'delete_account', 'data_export');--> statement-breakpoint
CREATE TYPE "public"."consent_source" AS ENUM('registration_form', 'settings_page', 'unsubscribe_link', 'country_change', 'document_update');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('terms', 'privacy', 'journalist_terms', 'email_subscription', 'minimum_age');--> statement-breakpoint
CREATE TYPE "public"."contact_request_status" AS ENUM('pending', 'approved', 'declined', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."contact_sharing" AS ENUM('none', 'email');--> statement-breakpoint
CREATE TYPE "public"."country_status" AS ENUM('draft', 'active', 'paused');--> statement-breakpoint
CREATE TYPE "public"."digest_delivery_status" AS ENUM('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed');--> statement-breakpoint
CREATE TYPE "public"."digest_status" AS ENUM('pending', 'sending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."email_subscription_status" AS ENUM('active', 'unsubscribed', 'bounced');--> statement-breakpoint
CREATE TYPE "public"."legal_document_type" AS ENUM('terms', 'privacy', 'journalist_terms');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('draft', 'submitted', 'changes_requested', 'approved', 'published', 'closed', 'expired', 'rejected', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."response_journalist_marking" AS ENUM('unreviewed', 'shortlisted', 'not_selected');--> statement-breakpoint
CREATE TYPE "public"."response_lifecycle_status" AS ENUM('submitted', 'withdrawn', 'hidden_by_moderator', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."suppression_reason" AS ENUM('unsubscribed', 'hard_bounce', 'complaint', 'manual');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('recipient', 'journalist', 'moderator', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending_email_verification', 'active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" "audit_actor_type" NOT NULL,
	"actor_user_id" uuid,
	"country_code" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"reason" text,
	"metadata" jsonb,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"purpose" "auth_token_purpose" DEFAULT 'login' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"consent_type" "consent_type" NOT NULL,
	"legal_document_id" uuid,
	"country_code" text NOT NULL,
	"locale" text NOT NULL,
	"granted" boolean NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"source" "consent_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"response_id" uuid NOT NULL,
	"journalist_id" uuid NOT NULL,
	"message" text NOT NULL,
	"requested_contact_method" text NOT NULL,
	"status" "contact_request_status" DEFAULT 'pending' NOT NULL,
	"shared_email" text,
	"responded_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_requests_response_id_unique" UNIQUE("response_id")
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"code" text PRIMARY KEY NOT NULL,
	"name_key" text NOT NULL,
	"default_locale" text NOT NULL,
	"available_locales" text[] NOT NULL,
	"timezone" text NOT NULL,
	"minimum_age" integer NOT NULL,
	"digest_send_time" text NOT NULL,
	"sender_name_key" text NOT NULL,
	"support_email" text NOT NULL,
	"status" "country_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digest_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"digest_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"access_token_hash" text NOT NULL,
	"provider_message_id" text,
	"status" "digest_delivery_status" DEFAULT 'queued' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" text NOT NULL,
	"scheduled_for" text NOT NULL,
	"request_ids" uuid[] NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"status" "digest_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "email_subscription_status" DEFAULT 'active' NOT NULL,
	"unsubscribe_token_hash" text NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"last_digest_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "journalist_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"job_title" text NOT NULL,
	"organization_name" text NOT NULL,
	"organization_url" text NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journalist_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "legal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" text NOT NULL,
	"locale" text NOT NULL,
	"document_type" "legal_document_type" NOT NULL,
	"version" text NOT NULL,
	"body" text NOT NULL,
	"is_material_change" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderator_countries" (
	"moderator_user_id" uuid NOT NULL,
	"country_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderator_countries_moderator_user_id_country_code_pk" PRIMARY KEY("moderator_user_id","country_code")
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journalist_id" uuid NOT NULL,
	"country_code" text NOT NULL,
	"content_language" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"description" text NOT NULL,
	"target_person_description" text NOT NULL,
	"topic" text,
	"geographic_note" text,
	"internal_reference" text,
	"response_deadline" timestamp with time zone NOT NULL,
	"status" "request_status" DEFAULT 'draft' NOT NULL,
	"allows_anonymous_participation" boolean NOT NULL,
	"may_be_recorded" boolean NOT NULL,
	"may_involve_photo_video" boolean NOT NULL,
	"moderator_comment" text,
	"moderated_by" uuid,
	"moderated_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"included_in_digest_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"respondent_id" uuid NOT NULL,
	"display_name_snapshot" text,
	"relevance_statement" text NOT NULL,
	"answer_text" text NOT NULL,
	"short_bio" text,
	"contact_sharing" "contact_sharing" DEFAULT 'none' NOT NULL,
	"lifecycle_status" "response_lifecycle_status" DEFAULT 'submitted' NOT NULL,
	"journalist_marking" "response_journalist_marking" DEFAULT 'unreviewed' NOT NULL,
	"journalist_note" text,
	"viewed_at" timestamp with time zone,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_hash" text NOT NULL,
	"reason" "suppression_reason" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppressions_email_hash_unique" UNIQUE("email_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_hash" text,
	"email_verified_at" timestamp with time zone,
	"role" "user_role" NOT NULL,
	"status" "user_status" DEFAULT 'pending_email_verification' NOT NULL,
	"country_code" text NOT NULL,
	"locale" text NOT NULL,
	"timezone" text,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_legal_document_id_legal_documents_id_fk" FOREIGN KEY ("legal_document_id") REFERENCES "public"."legal_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_response_id_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."responses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_journalist_id_users_id_fk" FOREIGN KEY ("journalist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_deliveries" ADD CONSTRAINT "digest_deliveries_digest_id_digests_id_fk" FOREIGN KEY ("digest_id") REFERENCES "public"."digests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_deliveries" ADD CONSTRAINT "digest_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digests" ADD CONSTRAINT "digests_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_subscriptions" ADD CONSTRAINT "email_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journalist_profiles" ADD CONSTRAINT "journalist_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journalist_profiles" ADD CONSTRAINT "journalist_profiles_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderator_countries" ADD CONSTRAINT "moderator_countries_moderator_user_id_users_id_fk" FOREIGN KEY ("moderator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderator_countries" ADD CONSTRAINT "moderator_countries_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_journalist_id_users_id_fk" FOREIGN KEY ("journalist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_respondent_id_users_id_fk" FOREIGN KEY ("respondent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "digest_deliveries_digest_user_idx" ON "digest_deliveries" USING btree ("digest_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "digests_country_scheduled_for_idx" ON "digests" USING btree ("country_code","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_documents_country_locale_type_version_idx" ON "legal_documents" USING btree ("country_code","locale","document_type","version");--> statement-breakpoint
CREATE UNIQUE INDEX "requests_slug_idx" ON "requests" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "requests_country_status_idx" ON "requests" USING btree ("country_code","status");--> statement-breakpoint
CREATE INDEX "requests_journalist_status_idx" ON "requests" USING btree ("journalist_id","status");--> statement-breakpoint
CREATE INDEX "responses_request_id_idx" ON "responses" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "responses_respondent_id_idx" ON "responses" USING btree ("respondent_id");