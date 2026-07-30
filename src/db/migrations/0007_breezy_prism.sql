ALTER TABLE "public"."requests" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."requests" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."request_status";--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('draft', 'submitted', 'changes_requested', 'published', 'closed', 'expired', 'rejected', 'deleted');--> statement-breakpoint
ALTER TABLE "public"."requests" ALTER COLUMN "status" SET DATA TYPE "public"."request_status" USING "status"::"public"."request_status";--> statement-breakpoint
ALTER TABLE "public"."requests" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."request_status";