ALTER TABLE "autonomy_events" ALTER COLUMN "timestamp" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deliberation_traces" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deliberation_traces" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;