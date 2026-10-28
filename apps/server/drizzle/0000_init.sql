CREATE TABLE "action_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"nonce" bigint NOT NULL,
	"idempotency_key" text NOT NULL,
	"season_id" integer NOT NULL,
	"seed_hex" text NOT NULL,
	"action" jsonb NOT NULL,
	"status" integer NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "balances" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"token_wei" numeric(78,0) DEFAULT 0 NOT NULL,
	"deposited_wei" numeric(78,0) DEFAULT 0 NOT NULL,
	"withdrawn_wei" numeric(78,0) DEFAULT 0 NOT NULL,
	"spent_wei" numeric(78,0) DEFAULT 0 NOT NULL,
	"earned_wei" numeric(78,0) DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "battle_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"opponent_player_id" uuid,
	"opponent" jsonb NOT NULL,
	"seed_hex" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chain_events" (
	"tx_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"block_number" bigint NOT NULL,
	"name" text NOT NULL,
	"args" jsonb NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chain_events_tx_hash_log_index_pk" PRIMARY KEY("tx_hash","log_index")
);
--> statement-breakpoint
CREATE TABLE "indexer_state" (
	"key" text PRIMARY KEY NOT NULL,
	"last_block" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text NOT NULL,
	"state" jsonb NOT NULL,
	"action_nonce" bigint DEFAULT 0 NOT NULL,
	"earning_unlocked" boolean DEFAULT false NOT NULL,
	"banned_at" timestamp with time zone,
	"ban_reason" text,
	"trophies" integer DEFAULT 0 NOT NULL,
	"defence_team" jsonb,
	"level" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "price_overrides" (
	"id" integer PRIMARY KEY NOT NULL,
	"micro_usd_per_token" numeric(78,0) NOT NULL,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"secret_hex" text NOT NULL,
	"commit_hash" text NOT NULL,
	"revealed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "siwe_nonces" (
	"nonce" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sp_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"season_id" integer NOT NULL,
	"day" integer NOT NULL,
	"source" text NOT NULL,
	"points" integer NOT NULL,
	"ref" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spend_batches" (
	"day" integer PRIMARY KEY NOT NULL,
	"spent_wei" numeric(78,0) DEFAULT 0 NOT NULL,
	"burned_wei" numeric(78,0) DEFAULT 0 NOT NULL,
	"burn_tx" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"cumulative_wei" numeric(78,0) NOT NULL,
	"gross_wei" numeric(78,0) NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"signature" text NOT NULL,
	"claimed_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_log" ADD CONSTRAINT "action_log_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_log" ADD CONSTRAINT "action_log_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balances" ADD CONSTRAINT "balances_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_offers" ADD CONSTRAINT "battle_offers_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_offers" ADD CONSTRAINT "battle_offers_opponent_player_id_players_id_fk" FOREIGN KEY ("opponent_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sp_ledger" ADD CONSTRAINT "sp_ledger_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sp_ledger" ADD CONSTRAINT "sp_ledger_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "action_log_player_key" ON "action_log" USING btree ("player_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "sp_ledger_once" ON "sp_ledger" USING btree ("player_id","season_id","day","source","ref");