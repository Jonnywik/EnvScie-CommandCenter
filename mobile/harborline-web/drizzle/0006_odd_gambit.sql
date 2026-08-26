CREATE TABLE `emergency_circle_location_pings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`membershipId` int NOT NULL,
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`accuracyMeters` double,
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `emergency_circle_location_pings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emergency_circle_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`circleId` int NOT NULL,
	`userId` int NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`role` enum('owner','member') NOT NULL DEFAULT 'member',
	`safetyStatus` enum('unknown','safe','needs_help') NOT NULL DEFAULT 'unknown',
	`sharingState` enum('stopped','sharing') NOT NULL DEFAULT 'stopped',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`lastStatusAt` timestamp NOT NULL DEFAULT (now()),
	`sharingEndsAt` timestamp,
	CONSTRAINT `emergency_circle_memberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emergency_circles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`inviteCode` varchar(32) NOT NULL,
	`createdBy` int NOT NULL,
	`active` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emergency_circles_id` PRIMARY KEY(`id`),
	CONSTRAINT `emergency_circles_inviteCode_unique` UNIQUE(`inviteCode`)
);
