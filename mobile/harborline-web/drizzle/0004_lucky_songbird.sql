CREATE TABLE `evacuation_center_audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`centerId` int NOT NULL,
	`actorId` int NOT NULL,
	`action` enum('created','updated','published','status_changed','retired') NOT NULL,
	`sourceName` varchar(180),
	`previousState` json,
	`nextState` json NOT NULL,
	`note` varchar(600),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evacuation_center_audits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `evacuation_centers` ADD `contactName` varchar(160);--> statement-breakpoint
ALTER TABLE `evacuation_centers` ADD `medicalSupport` varchar(180);--> statement-breakpoint
ALTER TABLE `evacuation_centers` ADD `sourceName` varchar(180);--> statement-breakpoint
ALTER TABLE `evacuation_centers` ADD `sourceReference` varchar(500);--> statement-breakpoint
ALTER TABLE `evacuation_centers` ADD `verificationStatus` enum('reference','verified','stale','retired') DEFAULT 'reference' NOT NULL;--> statement-breakpoint
ALTER TABLE `evacuation_centers` ADD `verifiedBy` int;--> statement-breakpoint
ALTER TABLE `evacuation_centers` ADD `verifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `evacuation_centers` ADD `freshUntil` timestamp;