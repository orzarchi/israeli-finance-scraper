CREATE TABLE `configurations` (
	`doc_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`doc_id` text PRIMARY KEY NOT NULL,
	`id` text,
	`provider` text NOT NULL,
	`account` text NOT NULL,
	`date` integer NOT NULL,
	`processed_date` integer NOT NULL,
	`original_amount` real NOT NULL,
	`original_currency` text NOT NULL,
	`charged_amount` real NOT NULL,
	`description` text NOT NULL,
	`memo` text,
	`installments_num` integer,
	`installments_total` integer,
	`scrape_id` text,
	`scrape_date` integer,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`approval_number` text,
	`user_note` text,
	`category` text
);
