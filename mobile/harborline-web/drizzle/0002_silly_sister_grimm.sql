CREATE TABLE `notification_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` int NOT NULL,
	`recipientRef` varchar(256) NOT NULL,
	`channel` enum('in_app','push') NOT NULL DEFAULT 'in_app',
	`status` enum('queued','sent','failed') NOT NULL DEFAULT 'queued',
	`attemptCount` int NOT NULL DEFAULT 0,
	`providerReference` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`deliveredAt` timestamp,
	CONSTRAINT `notification_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `volunteer_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fullName` varchar(160) NOT NULL,
	`contactPhone` varchar(48) NOT NULL,
	`barangay` varchar(180) NOT NULL,
	`skills` json NOT NULL,
	`availability` varchar(100) NOT NULL,
	`status` enum('submitted','verified','active') NOT NULL DEFAULT 'submitted',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `volunteer_profiles_id` PRIMARY KEY(`id`)
);
