CREATE TABLE `sos_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sosRequestId` int NOT NULL,
	`actionType` enum('submitted','acknowledged','assigned','contact_attempted','escalated','resolved','cancelled','report_promoted') NOT NULL,
	`actorId` int,
	`actorRole` varchar(48) NOT NULL,
	`note` varchar(600),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sos_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sos_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sosRequestId` int NOT NULL,
	`assigneeType` enum('lgu','ngo','response_team','other') NOT NULL DEFAULT 'lgu',
	`assigneeName` varchar(180) NOT NULL,
	`assignedBy` int NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	`releasedAt` timestamp,
	CONSTRAINT `sos_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sos_contact_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sosRequestId` int NOT NULL,
	`channel` enum('in_app','push','phone','radio','other') NOT NULL,
	`recipientRef` varchar(256) NOT NULL,
	`outcome` enum('queued','reached','failed','no_answer') NOT NULL DEFAULT 'queued',
	`attemptedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sos_contact_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sos_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientRequestId` varchar(96) NOT NULL,
	`publicReference` varchar(48) NOT NULL,
	`residentUserId` int,
	`sourceReportId` int,
	`category` enum('medical','rescue_evacuation','trapped_unsafe','other') NOT NULL,
	`priority` enum('high','critical') NOT NULL DEFAULT 'high',
	`message` varchar(280),
	`locationConsent` enum('granted','withheld') NOT NULL DEFAULT 'withheld',
	`latitude` double,
	`longitude` double,
	`accuracyMeters` double,
	`status` enum('submitted','acknowledged','assigned','escalated','resolved','cancelled') NOT NULL DEFAULT 'submitted',
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`acknowledgedAt` timestamp,
	`assignedAt` timestamp,
	`resolvedAt` timestamp,
	CONSTRAINT `sos_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `sos_requests_clientRequestId_unique` UNIQUE(`clientRequestId`),
	CONSTRAINT `sos_requests_publicReference_unique` UNIQUE(`publicReference`)
);
--> statement-breakpoint
ALTER TABLE `notification_events` MODIFY COLUMN `eventType` enum('geo_alert','family_checkin','incident_update','sos_submitted','sos_escalated','sos_status_update') NOT NULL;