CREATE INDEX `idx_album_device_position` ON `album_items` (`device_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_comments_photo_created` ON `comments` (`photo_id`,`created_at`);