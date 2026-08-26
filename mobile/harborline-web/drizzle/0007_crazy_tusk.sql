CREATE TABLE `emergency_circle_sos_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`circleId` int NOT NULL,
	`initiatorMembershipId` int NOT NULL,
	`message` varchar(280),
	`notificationEventId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `emergency_circle_sos_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `notification_events` MODIFY COLUMN `eventType` enum('geo_alert','family_checkin','incident_update','sos_submitted','sos_escalated','sos_status_update','circle_sos') NOT NULL;--> statement-breakpoint
ALTER TABLE `emergency_circle_memberships` ADD `approvalStatus` enum('pending','approved','rejected') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `emergency_circle_memberships` ADD `approvedAt` timestamp;--> statement-breakpoint
UPDATE `emergency_circle_memberships` SET `approvalStatus` = 'approved', `approvedAt` = `joinedAt`;
