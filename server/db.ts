import { desc, eq, sql } from "drizzle-orm";
import { db, sqlite } from "./db/connection.ts";
import {
  profile,
  projectHighlights,
  projectQuotes,
  projectSkills,
  projects,
  tailoredRuns,
} from "./db/schema.ts";
import type { Profile, Project, Quote, Skill } from "./schema.ts";

// Profile ------------------------------------------------------------------

const BLANK_PROFILE: Profile = {
  name: "",
  title_de: "",
  title_en: "",
  email: "",
  phone: "",
  location_de: "",
  location_en: "",
  linkedin: "",
  github: "",
  photo_path: "assets/profile_placeholder.svg",
  languages: [],
  education: [],
  hobbies_intro_de: "",
  hobbies_intro_en: "",
  hobbies_de: [],
  hobbies_en: [],
  summary_default_de: "",
  summary_default_en: "",
  featured_skills: [],
};

export function getProfile(): Profile {
  const row = db.select().from(profile).where(eq(profile.id, 1)).get();
  if (!row) return { ...BLANK_PROFILE };
  return {
    name: row.name,
    title_de: row.title_de,
    title_en: row.title_en,
    email: row.email,
    phone: row.phone,
    location_de: row.location_de,
    location_en: row.location_en,
    linkedin: row.linkedin,
    github: row.github,
    photo_path: row.photo_path,
    languages: JSON.parse(row.languages_json),
    education: JSON.parse(row.education_json),
    hobbies_intro_de: row.hobbies_intro_de,
    hobbies_intro_en: row.hobbies_intro_en,
    hobbies_de: JSON.parse(row.hobbies_de_json),
    hobbies_en: JSON.parse(row.hobbies_en_json),
    summary_default_de: row.summary_default_de,
    summary_default_en: row.summary_default_en,
    featured_skills: JSON.parse(row.featured_skills_json),
  };
}

export function putProfile(p: Profile): void {
  const values = {
    id: 1,
    name: p.name,
    title_de: p.title_de,
    title_en: p.title_en,
    email: p.email,
    phone: p.phone,
    location_de: p.location_de,
    location_en: p.location_en,
    linkedin: p.linkedin,
    github: p.github,
    photo_path: p.photo_path,
    languages_json: JSON.stringify(p.languages),
    education_json: JSON.stringify(p.education),
    hobbies_intro_de: p.hobbies_intro_de,
    hobbies_intro_en: p.hobbies_intro_en,
    hobbies_de_json: JSON.stringify(p.hobbies_de),
    hobbies_en_json: JSON.stringify(p.hobbies_en),
    summary_default_de: p.summary_default_de,
    summary_default_en: p.summary_default_en,
    featured_skills_json: JSON.stringify(p.featured_skills),
  };
  db.insert(profile)
    .values(values)
    .onConflictDoUpdate({ target: profile.id, set: values })
    .run();
}

// Projects -----------------------------------------------------------------

type ProjectRow = typeof projects.$inferSelect;

function hydrateProject(row: ProjectRow): Project {
  const highlights = db
    .select({ de: projectHighlights.de, en: projectHighlights.en })
    .from(projectHighlights)
    .where(eq(projectHighlights.project_id, row.id))
    .orderBy(projectHighlights.idx)
    .all();

  const skills = db
    .select({ skill: projectSkills.skill, level: projectSkills.level })
    .from(projectSkills)
    .where(eq(projectSkills.project_id, row.id))
    .orderBy(desc(projectSkills.level), projectSkills.skill)
    .all() as Skill[];

  const quotes = db
    .select({
      id: projectQuotes.id,
      text: projectQuotes.text,
      author: projectQuotes.author,
      role: projectQuotes.role,
    })
    .from(projectQuotes)
    .where(eq(projectQuotes.project_id, row.id))
    .orderBy(projectQuotes.id)
    .all() as Quote[];

  return {
    id: row.id,
    role_de: row.role_de,
    role_en: row.role_en,
    title_de: row.title_de,
    title_en: row.title_en,
    via: row.via,
    url: row.url,
    industry_de: row.industry_de,
    industry_en: row.industry_en,
    start_ym: row.start_ym,
    end_ym: row.end_ym,
    team_size: row.team_size,
    prio: row.prio,
    is_personal: row.is_personal,
    github_url: row.github_url,
    highlights,
    skills,
    quotes,
  };
}

export function listProjects(): Project[] {
  // "present" sorts after any "YYYY-MM" string, so DESC puts ongoing first.
  const rows = db
    .select()
    .from(projects)
    .orderBy(desc(projects.end_ym), desc(projects.start_ym))
    .all();
  return rows.map(hydrateProject);
}

export function getProject(id: string): Project | null {
  const row = db.select().from(projects).where(eq(projects.id, id)).get();
  return row ? hydrateProject(row) : null;
}

export function deleteProject(id: string): void {
  db.delete(projects).where(eq(projects.id, id)).run();
}

/** Rename a project's primary-key slug. Cascades to all child tables.
 *  `defer_foreign_keys = ON` inside the tx lets us update parent before
 *  children without tripping the FK check. */
export function renameProject(oldId: string, newId: string): void {
  db.transaction((tx) => {
    tx.run(sql`PRAGMA defer_foreign_keys = ON`);
    tx.update(projects).set({ id: newId }).where(eq(projects.id, oldId)).run();
    tx.update(projectHighlights)
      .set({ project_id: newId })
      .where(eq(projectHighlights.project_id, oldId))
      .run();
    tx.update(projectSkills)
      .set({ project_id: newId })
      .where(eq(projectSkills.project_id, oldId))
      .run();
    tx.update(projectQuotes)
      .set({ project_id: newId })
      .where(eq(projectQuotes.project_id, oldId))
      .run();
  });
}

export function upsertProject(p: Project): void {
  const projectValues = {
    id: p.id,
    role_de: p.role_de,
    role_en: p.role_en,
    title_de: p.title_de,
    title_en: p.title_en,
    via: p.via,
    url: p.url,
    industry_de: p.industry_de,
    industry_en: p.industry_en,
    start_ym: p.start_ym,
    end_ym: p.end_ym,
    team_size: p.team_size,
    prio: p.prio,
    is_personal: p.is_personal,
    github_url: p.github_url,
  };
  db.transaction((tx) => {
    tx.insert(projects)
      .values(projectValues)
      .onConflictDoUpdate({ target: projects.id, set: projectValues })
      .run();

    tx.delete(projectHighlights)
      .where(eq(projectHighlights.project_id, p.id))
      .run();
    if (p.highlights.length > 0) {
      tx.insert(projectHighlights)
        .values(
          p.highlights.map((h, idx) => ({
            project_id: p.id,
            idx,
            de: h.de,
            en: h.en,
          })),
        )
        .run();
    }

    tx.delete(projectSkills).where(eq(projectSkills.project_id, p.id)).run();
    if (p.skills.length > 0) {
      tx.insert(projectSkills)
        .values(
          p.skills.map((s) => ({
            project_id: p.id,
            skill: s.skill,
            level: s.level,
          })),
        )
        .run();
    }

    tx.delete(projectQuotes).where(eq(projectQuotes.project_id, p.id)).run();
    if (p.quotes.length > 0) {
      tx.insert(projectQuotes)
        .values(
          p.quotes.map((q) => ({
            project_id: p.id,
            text: q.text,
            author: q.author,
            role: q.role,
          })),
        )
        .run();
    }
  });
}

// Skills aggregate ---------------------------------------------------------

export type SkillAggregate = {
  skill: string;
  max_level: number;
  count: number;
};

export function listSkills(): SkillAggregate[] {
  return db
    .select({
      skill: projectSkills.skill,
      max_level: sql<number>`MAX(${projectSkills.level})`.as("max_level"),
      count: sql<number>`COUNT(*)`.as("count"),
    })
    .from(projectSkills)
    .groupBy(projectSkills.skill)
    .orderBy(sql`count DESC`, projectSkills.skill)
    .all();
}

export function maxLevelForSkill(skill: string): number {
  const row = db
    .select({ m: sql<number | null>`MAX(${projectSkills.level})` })
    .from(projectSkills)
    .where(sql`${projectSkills.skill} = ${skill} COLLATE NOCASE`)
    .get();
  return row?.m ?? 0;
}

/** Upsert a single skill across many projects in one transaction. Existing
 *  rows are overwritten with the new level. Returns the count actually
 *  written (skips ids that dont exist as projects). */
export function bulkAddSkill(
  skill: string,
  level: number,
  projectIds: string[],
): number {
  const lvl = Math.max(1, Math.min(4, Math.round(level)));
  let n = 0;
  db.transaction((tx) => {
    for (const pid of projectIds) {
      const exists = tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, pid))
        .get();
      if (!exists) continue;
      tx.insert(projectSkills)
        .values({ project_id: pid, skill, level: lvl })
        .onConflictDoUpdate({
          target: [projectSkills.project_id, projectSkills.skill],
          set: { level: lvl },
        })
        .run();
      n++;
    }
  });
  return n;
}

// Order by how strongly the project demonstrates the skill (ps.level DESC),
// then by project importance (prio), then by recency. Falls back to low
// priority only if no high/medium-prio project has the skill.
const PROJECTS_FOR_SKILL_ORDER = `ps.level DESC,
  (CASE p.prio WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END),
  p.end_ym DESC, p.start_ym DESC`;

export function projectsForSkill(skill: string): string[] {
  const nonLow = sqlite
    .query<{ id: string }, [string]>(
      `SELECT p.id FROM project_skills ps
       JOIN projects p ON p.id = ps.project_id
       WHERE ps.skill = ? COLLATE NOCASE AND p.prio != 'low'
       ORDER BY ${PROJECTS_FOR_SKILL_ORDER}`,
    )
    .all(skill)
    .map((r) => r.id);
  if (nonLow.length > 0) return nonLow;

  return sqlite
    .query<{ id: string }, [string]>(
      `SELECT p.id FROM project_skills ps
       JOIN projects p ON p.id = ps.project_id
       WHERE ps.skill = ? COLLATE NOCASE
       ORDER BY ${PROJECTS_FOR_SKILL_ORDER}`,
    )
    .all(skill)
    .map((r) => r.id);
}

// Tailored runs ------------------------------------------------------------

export function recordRun(args: {
  lang: string;
  slug: string;
  role_title: string;
  jd_text: string;
  summary: string;
  matrix_json: string;
  project_ids_json: string;
  run_group_id?: string;
  pdf_path: string;
  thumb_path?: string;
  html_path?: string;
}): number {
  const r = db
    .insert(tailoredRuns)
    .values({
      lang: args.lang,
      slug: args.slug,
      role_title: args.role_title,
      jd_text: args.jd_text,
      summary: args.summary,
      matrix_json: args.matrix_json,
      project_ids_json: args.project_ids_json,
      run_group_id: args.run_group_id ?? "",
      pdf_path: args.pdf_path,
      thumb_path: args.thumb_path ?? "",
      html_path: args.html_path ?? "",
    })
    .returning({ id: tailoredRuns.id })
    .get();
  return r.id;
}

export type RunFull = {
  id: number;
  created_at: string;
  lang: "de" | "en";
  slug: string;
  role_title: string;
  jd_text: string;
  summary: string;
  matrix_json: string;
  project_ids_json: string;
  run_group_id: string;
  pdf_path: string;
  thumb_path: string;
  html_path: string;
};

export function getRun(id: number): RunFull | null {
  const row = db
    .select()
    .from(tailoredRuns)
    .where(eq(tailoredRuns.id, id))
    .get();
  return (row as RunFull | undefined) ?? null;
}

export function listRuns(limit = 50) {
  return db
    .select({
      id: tailoredRuns.id,
      created_at: tailoredRuns.created_at,
      lang: tailoredRuns.lang,
      slug: tailoredRuns.slug,
      role_title: tailoredRuns.role_title,
      run_group_id: tailoredRuns.run_group_id,
      pdf_path: tailoredRuns.pdf_path,
      thumb_path: tailoredRuns.thumb_path,
      html_path: tailoredRuns.html_path,
    })
    .from(tailoredRuns)
    .orderBy(desc(tailoredRuns.id))
    .limit(limit)
    .all();
}

export function getRunFiles(
  id: number,
): { pdf: string; thumb: string; html: string } | null {
  const row = db
    .select({
      pdf: tailoredRuns.pdf_path,
      thumb: tailoredRuns.thumb_path,
      html: tailoredRuns.html_path,
    })
    .from(tailoredRuns)
    .where(eq(tailoredRuns.id, id))
    .get();
  return row ?? null;
}

export function deleteRun(id: number): void {
  db.delete(tailoredRuns).where(eq(tailoredRuns.id, id)).run();
}

export function deleteAllRuns(): { paths: string[] } {
  const rows = db
    .select({
      pdf: tailoredRuns.pdf_path,
      thumb: tailoredRuns.thumb_path,
      html: tailoredRuns.html_path,
    })
    .from(tailoredRuns)
    .all();
  db.delete(tailoredRuns).run();
  const paths: string[] = [];
  for (const r of rows) {
    if (r.pdf) paths.push(r.pdf);
    if (r.thumb) paths.push(r.thumb);
    if (r.html) paths.push(r.html);
  }
  return { paths };
}
