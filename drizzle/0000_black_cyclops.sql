CREATE TABLE `households` (
	`owner` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`operation` text DEFAULT '' NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`owner` text NOT NULL,
	`store` text NOT NULL,
	`id` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`owner`, `store`, `id`)
);
