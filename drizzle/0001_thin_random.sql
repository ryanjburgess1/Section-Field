CREATE TABLE IF NOT EXISTS `project_tile_corrections` (
	`user_id` text NOT NULL,
	`tile_id` integer NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`user_id`, `tile_id`)
);
