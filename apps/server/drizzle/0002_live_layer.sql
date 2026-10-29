CREATE TABLE "referral_payouts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referred_id" uuid NOT NULL,
	"wei" numeric(78,0) NOT NULL,
	"ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_payouts_ref_unique" UNIQUE("ref")
);
--> statement-breakpoint
CREATE TABLE "season_prizes" (
	"season_id" integer NOT NULL,
	"player_id" uuid NOT NULL,
	"wei" numeric(78,0) NOT NULL,
	"tier" integer,
	"rank" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "season_prizes_season_id_player_id_pk" PRIMARY KEY("season_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "vault_inflows" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"source" text NOT NULL,
	"wei" numeric(78,0) NOT NULL,
	"ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "referrer_id" uuid;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "ip_hash" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "device_hash" text;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "referral_payouts" ADD CONSTRAINT "referral_payouts_referrer_id_players_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_payouts" ADD CONSTRAINT "referral_payouts_referred_id_players_id_fk" FOREIGN KEY ("referred_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_prizes" ADD CONSTRAINT "season_prizes_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_prizes" ADD CONSTRAINT "season_prizes_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_inflows" ADD CONSTRAINT "vault_inflows_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referral_payouts_referrer" ON "referral_payouts" USING btree ("referrer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vault_inflows_source_ref" ON "vault_inflows" USING btree ("source","ref");--> statement-breakpoint
CREATE INDEX "vault_inflows_season" ON "vault_inflows" USING btree ("season_id");