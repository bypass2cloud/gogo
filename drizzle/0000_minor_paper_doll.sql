CREATE TABLE `album_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`device_id` text NOT NULL,
	`photo_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`image_url` text NOT NULL,
	`original_url` text,
	`flickr_url` text NOT NULL,
	`owner_id` text NOT NULL,
	`owner_name` text NOT NULL,
	`date_taken` text,
	`date_uploaded` text,
	`latitude` real,
	`longitude` real,
	`location_name` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`license` text,
	`width` integer,
	`height` integer,
	`saved_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_album_device_photo` ON `album_items` (`device_id`,`photo_id`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`photo_id` text NOT NULL,
	`device_id` text NOT NULL,
	`author_name` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
