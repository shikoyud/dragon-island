-- Ruling R14 (GDD A3): entrants keep the element they were given, under its new id.
UPDATE "entrants" SET "element" = 'flame' WHERE "element" = 'fire';--> statement-breakpoint
UPDATE "entrants" SET "element" = 'sea' WHERE "element" = 'water';--> statement-breakpoint
UPDATE "entrants" SET "element" = 'terra' WHERE "element" = 'earth';
