ALTER TABLE `inquiries` ADD `subject` text;--> statement-breakpoint
ALTER TABLE `inquiries` ADD `context` text;--> statement-breakpoint
ALTER TABLE `store_settings` ADD `public_origin` text;--> statement-breakpoint
ALTER TABLE `store_settings` ADD `allowed_shipping_countries_json` text DEFAULT '["US"]' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_settings` ADD `flat_shipping_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `store_settings` ADD `automatic_tax_enabled` integer DEFAULT false NOT NULL;