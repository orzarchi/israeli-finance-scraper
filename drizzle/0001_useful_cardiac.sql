PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_configurations` (
	`doc_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`payload` text NOT NULL,
	CONSTRAINT "configurations_payload_is_json" CHECK(json_valid("__new_configurations"."payload"))
);
--> statement-breakpoint
INSERT INTO `__new_configurations`("doc_id", "id", "payload") SELECT "doc_id", "id", "payload" FROM `configurations`;--> statement-breakpoint
DROP TABLE `configurations`;--> statement-breakpoint
ALTER TABLE `__new_configurations` RENAME TO `configurations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;