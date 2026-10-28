CREATE TABLE "burn_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day" integer NOT NULL,
	"amount_wei" numeric(78,0) NOT NULL,
	"tx_hash" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_log" ADD COLUMN "seed_label" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "chain_events" ADD COLUMN "applied" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "action_log_season_player_idx" ON "action_log" USING btree ("season_id","player_id","nonce");--> statement-breakpoint
CREATE INDEX "battle_offers_player_idx" ON "battle_offers" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_starts_at_unique" ON "seasons" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "sessions_player_idx" ON "sessions" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "vouchers_open_idx" ON "vouchers" USING btree ("player_id") WHERE claimed_at is null and expired_at is null;