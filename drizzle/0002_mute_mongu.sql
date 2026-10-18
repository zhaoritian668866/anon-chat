CREATE TABLE `access_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`expiresInHours` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`status` enum('active','expired','revoked') NOT NULL DEFAULT 'active',
	`note` varchar(200),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `access_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `access_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `messages` MODIFY COLUMN `type` enum('text','image','location','system') NOT NULL DEFAULT 'text';--> statement-breakpoint
CREATE INDEX `idx_token` ON `access_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `idx_expiresAt` ON `access_tokens` (`expiresAt`);