CREATE TABLE IF NOT EXISTS "autonomy_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trace_id" text NOT NULL,
	"turn_id" text NOT NULL,
	"request_id" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" varchar REFERENCES "users"("id"),
	"project_id" varchar REFERENCES "projects"("id"),
	"team_id" varchar REFERENCES "teams"("id"),
	"conversation_id" text NOT NULL,
	"hatch_id" varchar REFERENCES "agents"("id"),
	"provider" text,
	"mode" text,
	"latency_ms" integer,
	"confidence" double precision,
	"risk_score" double precision,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deliberation_traces" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trace_id" text NOT NULL UNIQUE,
	"user_id" varchar REFERENCES "users"("id"),
	"project_id" varchar NOT NULL REFERENCES "projects"("id"),
	"team_id" varchar REFERENCES "teams"("id"),
	"conversation_id" text NOT NULL,
	"objective" text NOT NULL,
	"rounds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"review" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"final_synthesis" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "autonomy_events"
	ALTER COLUMN "timestamp" TYPE timestamp with time zone
	USING "timestamp" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "deliberation_traces"
	ALTER COLUMN "created_at" TYPE timestamp with time zone
	USING "created_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "deliberation_traces"
	ALTER COLUMN "updated_at" TYPE timestamp with time zone
	USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "autonomy_events_trace_id_idx" ON "autonomy_events" USING btree ("trace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "autonomy_events_project_id_idx" ON "autonomy_events" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "autonomy_events_conversation_id_idx" ON "autonomy_events" USING btree ("conversation_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "autonomy_events_timestamp_idx" ON "autonomy_events" USING btree ("timestamp");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deliberation_traces_trace_id_idx" ON "deliberation_traces" USING btree ("trace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deliberation_traces_project_id_idx" ON "deliberation_traces" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deliberation_traces_conversation_id_idx" ON "deliberation_traces" USING btree ("conversation_id");
