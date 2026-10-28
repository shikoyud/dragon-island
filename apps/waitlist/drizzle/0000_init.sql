CREATE TABLE "entrants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"x_user_id" text NOT NULL,
	"x_handle" text NOT NULL,
	"x_name" text NOT NULL,
	"x_avatar_url" text,
	"x_created_at" timestamp with time zone NOT NULL,
	"wallet" text,
	"wallet_signed_at" timestamp with time zone,
	"position" integer,
	"element" text NOT NULL,
	"ref_code" text NOT NULL,
	"referred_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"joined_at" timestamp with time zone,
	CONSTRAINT "entrants_x_user_id_unique" UNIQUE("x_user_id"),
	CONSTRAINT "entrants_wallet_unique" UNIQUE("wallet"),
	CONSTRAINT "entrants_position_unique" UNIQUE("position"),
	CONSTRAINT "entrants_ref_code_unique" UNIQUE("ref_code")
);
--> statement-breakpoint
CREATE TABLE "task_events" (
	"entrant_id" uuid NOT NULL,
	"task" text NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "task_events_entrant_id_task_pk" PRIMARY KEY("entrant_id","task"),
	CONSTRAINT "task_events_task_check" CHECK ("task_events"."task" in ('follow','like','repost','comment'))
);
--> statement-breakpoint
CREATE TABLE "wallet_nonces" (
	"nonce" text PRIMARY KEY NOT NULL,
	"entrant_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entrants" ADD CONSTRAINT "entrants_referred_by_entrants_id_fk" FOREIGN KEY ("referred_by") REFERENCES "public"."entrants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_entrant_id_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."entrants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_nonces" ADD CONSTRAINT "wallet_nonces_entrant_id_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."entrants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE SEQUENCE "waitlist_position_seq" START WITH 1 INCREMENT BY 1;
