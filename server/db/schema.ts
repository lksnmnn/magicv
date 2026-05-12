import { sql } from "drizzle-orm";
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

// Singleton profile row pinned to id = 1.
export const profile = sqliteTable(
  "profile",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull().default(""),
    title_de: text("title_de").notNull().default(""),
    title_en: text("title_en").notNull().default(""),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    location_de: text("location_de").notNull().default(""),
    location_en: text("location_en").notNull().default(""),
    linkedin: text("linkedin").notNull().default(""),
    github: text("github").notNull().default(""),
    photo_path: text("photo_path")
      .notNull()
      .default("assets/profile_placeholder.svg"),
    languages_json: text("languages_json").notNull().default("[]"),
    education_json: text("education_json").notNull().default("[]"),
    hobbies_intro_de: text("hobbies_intro_de").notNull().default(""),
    hobbies_intro_en: text("hobbies_intro_en").notNull().default(""),
    hobbies_de_json: text("hobbies_de_json").notNull().default("[]"),
    hobbies_en_json: text("hobbies_en_json").notNull().default("[]"),
    summary_default_de: text("summary_default_de").notNull().default(""),
    summary_default_en: text("summary_default_en").notNull().default(""),
    featured_skills_json: text("featured_skills_json").notNull().default("[]"),
  },
  (t) => [check("singleton", sql`${t.id} = 1`)],
);

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    role_de: text("role_de").notNull().default(""),
    role_en: text("role_en").notNull().default(""),
    title_de: text("title_de").notNull().default(""),
    title_en: text("title_en").notNull().default(""),
    via: text("via").notNull().default(""),
    url: text("url").notNull().default(""),
    industry_de: text("industry_de").notNull().default(""),
    industry_en: text("industry_en").notNull().default(""),
    start_ym: text("start_ym").notNull(),
    end_ym: text("end_ym").notNull(),
    team_size: integer("team_size"),
    prio: text("prio", { enum: ["high", "medium", "low"] })
      .notNull()
      .default("medium"),
    is_personal: integer("is_personal", { mode: "boolean" })
      .notNull()
      .default(false),
    github_url: text("github_url").notNull().default(""),
  },
  (t) => [check("prio_check", sql`${t.prio} IN ('high','medium','low')`)],
);

export const projectHighlights = sqliteTable(
  "project_highlights",
  {
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    de: text("de").notNull().default(""),
    en: text("en").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.project_id, t.idx] })],
);

export const projectSkills = sqliteTable(
  "project_skills",
  {
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    skill: text("skill").notNull(),
    level: integer("level").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.project_id, t.skill] }),
    check("level_check", sql`${t.level} BETWEEN 1 AND 4`),
  ],
);

export const projectQuotes = sqliteTable("project_quotes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  project_id: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  author: text("author").notNull().default(""),
  role: text("role").notNull().default(""),
});

export const tailoredRuns = sqliteTable("tailored_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  lang: text("lang").notNull(),
  slug: text("slug").notNull(),
  role_title: text("role_title").notNull(),
  jd_text: text("jd_text").notNull(),
  summary: text("summary").notNull(),
  matrix_json: text("matrix_json").notNull(),
  pdf_path: text("pdf_path").notNull().default(""),
  thumb_path: text("thumb_path").notNull().default(""),
  html_path: text("html_path").notNull().default(""),
  project_ids_json: text("project_ids_json").notNull().default("[]"),
  run_group_id: text("run_group_id").notNull().default(""),
});
