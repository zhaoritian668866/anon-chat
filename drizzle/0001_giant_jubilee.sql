CREATE TABLE `chat_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uniqueId` varchar(16) NOT NULL,
	`nickname` varchar(50) NOT NULL,
	`avatar` text,
	`avatarStyle` varchar(32) DEFAULT 'adventurer',
	`status` enum('active','banned') NOT NULL DEFAULT 'active',
	`lastOnline` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chat_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `chat_users_uniqueId_unique` UNIQUE(`uniqueId`)
);
--> statement-breakpoint
CREATE TABLE `friendships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requesterId` int NOT NULL,
	`addresseeId` int NOT NULL,
	`status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `friendships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`senderId` int NOT NULL,
	`receiverId` int NOT NULL,
	`content` text NOT NULL,
	`type` enum('text','image','system') NOT NULL DEFAULT 'text',
	`isRead` boolean NOT NULL DEFAULT false,
	`sentAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin') NOT NULL DEFAULT 'admin';--> statement-breakpoint
CREATE INDEX `idx_uniqueId` ON `chat_users` (`uniqueId`);--> statement-breakpoint
CREATE INDEX `idx_requester` ON `friendships` (`requesterId`);--> statement-breakpoint
CREATE INDEX `idx_addressee` ON `friendships` (`addresseeId`);--> statement-breakpoint
CREATE INDEX `idx_sender` ON `messages` (`senderId`);--> statement-breakpoint
CREATE INDEX `idx_receiver` ON `messages` (`receiverId`);--> statement-breakpoint
CREATE INDEX `idx_sentAt` ON `messages` (`sentAt`);