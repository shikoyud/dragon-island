CREATE TABLE "beta_allowlist" (
	"address" text PRIMARY KEY NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
