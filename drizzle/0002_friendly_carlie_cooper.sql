CREATE TABLE `albums` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`device_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_albums_device_name` ON `albums` (`device_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_albums_device_position` ON `albums` (`device_id`,`position`);--> statement-breakpoint
CREATE TABLE `album_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`album_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`saved_at` text NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `album_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_album_photos_album_item` ON `album_photos` (`album_id`,`item_id`);--> statement-breakpoint
CREATE INDEX `idx_album_photos_album_position` ON `album_photos` (`album_id`,`position`);--> statement-breakpoint
CREATE TABLE `album_migrations` (
	`device_id` text PRIMARY KEY NOT NULL,
	`migrated_at` text NOT NULL
);
