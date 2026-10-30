CREATE TABLE "game" (
	"id" integer PRIMARY KEY NOT NULL,
	"secret_hex" text NOT NULL,
	"commit_hash" text NOT NULL,
	"revealed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "action_log_season_player_idx";--> statement-breakpoint
ALTER TABLE "action_log" DROP CONSTRAINT "action_log_season_id_seasons_id_fk";
--> statement-breakpoint
ALTER TABLE "action_log" DROP COLUMN "season_id";--> statement-breakpoint
DROP TABLE "season_prizes";--> statement-breakpoint
DROP TABLE "vault_inflows";--> statement-breakpoint
DROP TABLE "sp_ledger";--> statement-breakpoint
DROP TABLE "referral_payouts";--> statement-breakpoint
DROP TABLE "seasons";--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "referrer_id";
