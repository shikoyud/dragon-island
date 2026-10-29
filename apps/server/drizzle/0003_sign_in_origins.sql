CREATE TABLE "sign_in_origins" (
	"player_id" uuid NOT NULL,
	"ip_hash" text DEFAULT '' NOT NULL,
	"device_hash" text DEFAULT '' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sign_in_origins_player_id_ip_hash_device_hash_pk" PRIMARY KEY("player_id","ip_hash","device_hash")
);
--> statement-breakpoint
ALTER TABLE "sign_in_origins" ADD CONSTRAINT "sign_in_origins_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;