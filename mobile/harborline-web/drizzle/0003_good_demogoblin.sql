CREATE TABLE `lgu_closure_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(220) NOT NULL,
	`barangay` varchar(180) NOT NULL,
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`access` enum('use_caution','restricted','closed') NOT NULL,
	`cause` varchar(320) NOT NULL,
	`severity` enum('advisory','watch','warning','critical') NOT NULL DEFAULT 'warning',
	`status` enum('active','cleared') NOT NULL DEFAULT 'active',
	`verifiedBy` int NOT NULL,
	`verifiedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lgu_closure_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `map_incidents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientRequestId` varchar(96) NOT NULL,
	`category` enum('flooding','road_blockage','structural_damage','medical_sos','other') NOT NULL,
	`barangay` varchar(180) NOT NULL,
	`summary` text NOT NULL,
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`severity` enum('advisory','watch','warning','critical') NOT NULL DEFAULT 'watch',
	`status` enum('submitted','verified','rejected','resolved') NOT NULL DEFAULT 'submitted',
	`photoObjectKey` varchar(512) NOT NULL,
	`photoObjectUrl` varchar(700) NOT NULL,
	`photoMimeType` varchar(80) NOT NULL,
	`photoByteSize` bigint NOT NULL,
	`photoChecksum` varchar(128) NOT NULL,
	`mapConsent` enum('granted','withheld') NOT NULL DEFAULT 'withheld',
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `map_incidents_id` PRIMARY KEY(`id`),
	CONSTRAINT `map_incidents_clientRequestId_unique` UNIQUE(`clientRequestId`),
	CONSTRAINT `map_incidents_photoObjectKey_unique` UNIQUE(`photoObjectKey`)
);
