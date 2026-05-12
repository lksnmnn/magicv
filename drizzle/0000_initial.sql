CREATE TABLE IF NOT EXISTS `profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`title_de` text DEFAULT '' NOT NULL,
	`title_en` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`location_de` text DEFAULT '' NOT NULL,
	`location_en` text DEFAULT '' NOT NULL,
	`linkedin` text DEFAULT '' NOT NULL,
	`github` text DEFAULT '' NOT NULL,
	`photo_path` text DEFAULT 'assets/profile_placeholder.svg' NOT NULL,
	`languages_json` text DEFAULT '[]' NOT NULL,
	`education_json` text DEFAULT '[]' NOT NULL,
	`hobbies_intro_de` text DEFAULT '' NOT NULL,
	`hobbies_intro_en` text DEFAULT '' NOT NULL,
	`hobbies_de_json` text DEFAULT '[]' NOT NULL,
	`hobbies_en_json` text DEFAULT '[]' NOT NULL,
	`summary_default_de` text DEFAULT '' NOT NULL,
	`summary_default_en` text DEFAULT '' NOT NULL,
	`featured_skills_json` text DEFAULT '[]' NOT NULL,
	CONSTRAINT "singleton" CHECK("profile"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `project_highlights` (
	`project_id` text NOT NULL,
	`idx` integer NOT NULL,
	`de` text DEFAULT '' NOT NULL,
	`en` text DEFAULT '' NOT NULL,
	PRIMARY KEY(`project_id`, `idx`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `project_quotes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`text` text NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `project_skills` (
	`project_id` text NOT NULL,
	`skill` text NOT NULL,
	`level` integer NOT NULL,
	PRIMARY KEY(`project_id`, `skill`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "level_check" CHECK("project_skills"."level" BETWEEN 1 AND 4)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`role_de` text DEFAULT '' NOT NULL,
	`role_en` text DEFAULT '' NOT NULL,
	`title_de` text DEFAULT '' NOT NULL,
	`title_en` text DEFAULT '' NOT NULL,
	`via` text DEFAULT '' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`industry_de` text DEFAULT '' NOT NULL,
	`industry_en` text DEFAULT '' NOT NULL,
	`start_ym` text NOT NULL,
	`end_ym` text NOT NULL,
	`team_size` integer,
	`prio` text DEFAULT 'medium' NOT NULL,
	`is_personal` integer DEFAULT false NOT NULL,
	`github_url` text DEFAULT '' NOT NULL,
	CONSTRAINT "prio_check" CHECK("projects"."prio" IN ('high','medium','low'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tailored_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`lang` text NOT NULL,
	`slug` text NOT NULL,
	`role_title` text NOT NULL,
	`jd_text` text NOT NULL,
	`summary` text NOT NULL,
	`matrix_json` text NOT NULL,
	`pdf_path` text DEFAULT '' NOT NULL,
	`thumb_path` text DEFAULT '' NOT NULL,
	`html_path` text DEFAULT '' NOT NULL,
	`project_ids_json` text DEFAULT '[]' NOT NULL,
	`run_group_id` text DEFAULT '' NOT NULL
);
