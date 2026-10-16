CREATE TABLE `request_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `request_rate_limits_expiry_idx` ON `request_rate_limits` (`expires_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_store_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`store_name` text DEFAULT 'Trace' NOT NULL,
	`support_email` text DEFAULT '' NOT NULL,
	`currency` text DEFAULT 'usd' NOT NULL,
	`public_origin` text,
	`allowed_shipping_countries_json` text DEFAULT '["US"]' NOT NULL,
	`flat_shipping_cents` integer DEFAULT 0 NOT NULL,
	`automatic_tax_enabled` integer DEFAULT false NOT NULL,
	`checkout_enabled` integer DEFAULT true NOT NULL,
	`updated_by_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_store_settings`("id", "store_name", "support_email", "currency", "public_origin", "allowed_shipping_countries_json", "flat_shipping_cents", "automatic_tax_enabled", "checkout_enabled", "updated_by_user_id", "created_at", "updated_at") SELECT "id", "store_name", "support_email", "currency", "public_origin", "allowed_shipping_countries_json", "flat_shipping_cents", "automatic_tax_enabled", "checkout_enabled", "updated_by_user_id", "created_at", "updated_at" FROM `store_settings`;--> statement-breakpoint
DROP TABLE `store_settings`;--> statement-breakpoint
ALTER TABLE `__new_store_settings` RENAME TO `store_settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;