ALTER TABLE "requests" ALTER COLUMN "slug" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "title" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "summary" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "target_person_description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "response_deadline" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "allows_anonymous_participation" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "may_be_recorded" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "may_involve_photo_video" DROP NOT NULL;