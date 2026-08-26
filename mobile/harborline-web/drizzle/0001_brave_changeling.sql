CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`headline` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`severity` enum('advisory','watch','warning','critical') NOT NULL DEFAULT 'advisory',
	`targetName` varchar(200) NOT NULL,
	`targetGeometry` json,
	`status` enum('draft','issued','cancelled','expired') NOT NULL DEFAULT 'draft',
	`issuedBy` int,
	`issuedAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evacuation_centers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`barangay` varchar(180) NOT NULL,
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`capacity` int NOT NULL,
	`availableSlots` int NOT NULL,
	`operationalStatus` enum('open','limited','full','closed') NOT NULL DEFAULT 'open',
	`accessibility` json,
	`contactPhone` varchar(48),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `evacuation_centers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incident_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`objectKey` varchar(512) NOT NULL,
	`objectUrl` varchar(700) NOT NULL,
	`originalFilename` varchar(255) NOT NULL,
	`mimeType` varchar(80) NOT NULL,
	`byteSize` bigint NOT NULL,
	`checksum` varchar(128) NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `incident_evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `incident_evidence_objectKey_unique` UNIQUE(`objectKey`)
);
--> statement-breakpoint
CREATE TABLE `incident_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientRequestId` varchar(96) NOT NULL,
	`category` enum('flooding','road_blockage','structural_damage','medical_sos','other') NOT NULL,
	`description` text,
	`latitude` double,
	`longitude` double,
	`accuracyMeters` double,
	`locationLabel` varchar(255),
	`status` enum('queued','new','verified','assigned','resolved','rejected') NOT NULL DEFAULT 'queued',
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`receivedAt` timestamp,
	CONSTRAINT `incident_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `incident_reports_clientRequestId_unique` UNIQUE(`clientRequestId`)
);
--> statement-breakpoint
CREATE TABLE `notification_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventType` enum('geo_alert','family_checkin','incident_update') NOT NULL,
	`audienceScope` json NOT NULL,
	`payload` json NOT NULL,
	`deliveryStatus` enum('queued','sent','failed') NOT NULL DEFAULT 'queued',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`deliveredAt` timestamp,
	CONSTRAINT `notification_events_id` PRIMARY KEY(`id`)
);
