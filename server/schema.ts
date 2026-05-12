import { z } from "zod";

export const Lang = z.enum(["de", "en"]);
export type Lang = z.infer<typeof Lang>;

const Prio = z.enum(["high", "medium", "low"]);

const SkillLevel = z.number().int().min(1).max(4);

export const Skill = z.object({
  skill: z.string().min(1),
  level: SkillLevel,
});
export type Skill = z.infer<typeof Skill>;

export const Quote = z.object({
  id: z.number().int().optional(),
  text: z.string().min(1),
  author: z.string().default(""),
  role: z.string().default(""),
});
export type Quote = z.infer<typeof Quote>;

const HighlightPair = z.object({
  de: z.string().default(""),
  en: z.string().default(""),
});
type HighlightPair = z.infer<typeof HighlightPair>;

// Pre-transform: accept legacy `highlights_de` + `highlights_en` arrays and
// zip them into the new paired form. Lets older seed YAMLs / API clients
// keep working through the transition.
const ProjectRaw = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^[a-z0-9][a-z0-9-]*$/),
    role_de: z.string().default(""),
    role_en: z.string().default(""),
    title_de: z.string().default(""),
    title_en: z.string().default(""),
    via: z.string().default(""),
    url: z.string().default(""),
    industry_de: z.string().default(""),
    industry_en: z.string().default(""),
    start_ym: z.string().regex(/^\d{4}-\d{2}$/),
    end_ym: z.union([z.literal("present"), z.string().regex(/^\d{4}-\d{2}$/)]),
    team_size: z.number().int().nullable().default(null),
    prio: Prio.default("medium"),
    is_personal: z.boolean().default(false),
    github_url: z.string().url().or(z.literal("")).default(""),
    highlights: z.array(HighlightPair).optional(),
    highlights_de: z.array(z.string()).optional(),
    highlights_en: z.array(z.string()).optional(),
    skills: z.array(Skill).default([]),
    quotes: z.array(Quote).default([]),
  })
  .transform((p) => {
    if (p.highlights) return { ...p, highlights: p.highlights };
    const de = p.highlights_de ?? [];
    const en = p.highlights_en ?? [];
    const len = Math.max(de.length, en.length);
    const pairs: HighlightPair[] = [];
    for (let i = 0; i < len; i++) {
      pairs.push({ de: de[i] ?? "", en: en[i] ?? "" });
    }
    return { ...p, highlights: pairs };
  });

export const Project = ProjectRaw.pipe(
  z.object({
    id: z.string(),
    role_de: z.string(),
    role_en: z.string(),
    title_de: z.string(),
    title_en: z.string(),
    via: z.string(),
    url: z.string(),
    industry_de: z.string(),
    industry_en: z.string(),
    start_ym: z.string(),
    end_ym: z.union([z.literal("present"), z.string()]),
    team_size: z.number().int().nullable(),
    prio: Prio,
    is_personal: z.boolean(),
    github_url: z.string(),
    highlights: z.array(HighlightPair),
    highlights_de: z.array(z.string()).optional(),
    highlights_en: z.array(z.string()).optional(),
    skills: z.array(Skill),
    quotes: z.array(Quote),
  }),
);
export type Project = z.infer<typeof Project>;

const LanguageEntry = z.object({
  name_de: z.string(),
  name_en: z.string(),
  level_de: z.string(),
  level_en: z.string(),
});

const EducationEntry = z.object({
  degree_de: z.string(),
  degree_en: z.string(),
  school: z.string(),
  year: z.number().int(),
});

export const Profile = z.object({
  name: z.string().default(""),
  title_de: z.string().default(""),
  title_en: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  location_de: z.string().default(""),
  location_en: z.string().default(""),
  linkedin: z.string().default(""),
  github: z.string().default(""),
  // Constrained so a malicious PUT can't point this at /etc/passwd and have
  // the renderer inline arbitrary local files as base64 in the PDF.
  photo_path: z
    .string()
    .regex(/^assets\/(profile_placeholder\.svg|uploads\/[A-Za-z0-9._-]+)$/)
    .default("assets/profile_placeholder.svg"),
  languages: z.array(LanguageEntry).default([]),
  education: z.array(EducationEntry).default([]),
  hobbies_intro_de: z.string().default(""),
  hobbies_intro_en: z.string().default(""),
  hobbies_de: z.array(z.string()).default([]),
  hobbies_en: z.array(z.string()).default([]),
  summary_default_de: z.string().default(""),
  summary_default_en: z.string().default(""),
  featured_skills: z.array(z.string()).default([]),
});
export type Profile = z.infer<typeof Profile>;

// LLM output shapes

export const ExtractOut = z.object({
  role_title: z.string().default(""),
  summary_hint: z.string().default(""),
  must_have: z.array(z.string()).default([]),
  should_have: z.array(z.string()).default([]),
});
export type ExtractOut = z.infer<typeof ExtractOut>;

export const SummaryOut = z.object({
  summary: z.string(),
});
export type SummaryOut = z.infer<typeof SummaryOut>;

// API request bodies

export const TailorRequest = z.object({
  jd_text: z.string().min(10),
  lang: Lang,
});

export const RenderRequest = z.object({
  lang: Lang,
  role_title: z.string(),
  summary: z.string(),
  matrix: z.array(
    z.object({
      skill: z.string(),
      // 0 = candidate has no experience (JD-required gap); 1..4 = proficiency.
      level: z.number().int().min(0).max(4),
      kind: z.enum(["must", "should"]),
      project_ids: z.array(z.string()),
      // UI-only flag preserved so a re-opened run can restore the toggle state.
      // Rows with included=false are filtered out before rendering.
      included: z.boolean().optional(),
    }),
  ),
  project_ids: z.array(z.string()),
  jd_text: z.string().default(""),
  // Optional group id minted client-side so the DE + EN halves of a single
  // "render both" can be paired in the Recent Runs list.
  group_id: z.string().default(""),
});
export type RenderRequest = z.infer<typeof RenderRequest>;

const MatrixEntry = z.object({
  skill: z.string(),
  level: z.number().int().min(0).max(4),
  kind: z.enum(["must", "should"]),
  project_ids: z.array(z.string()).default([]),
});

export const BulkAddSkillsRequest = z.object({
  skill: z.string().min(1),
  level: SkillLevel.default(3),
  project_ids: z.array(z.string().min(1)).min(1),
});

export const MatchRequest = z.object({
  must_have: z.array(z.string()).default([]),
  should_have: z.array(z.string()).default([]),
});

export const TranslateRequest = z.object({
  text: z.string().default(""),
  from: Lang,
  to: Lang,
  context: z.string().optional(),
});

export const SuggestSkillsRequest = z.object({
  highlights: z.array(z.string()).default([]),
  existing_skills: z.array(z.string()).default([]),
});

export const SummaryGenerateRequest = z.object({
  lang: Lang,
  role_title: z.string().default(""),
  summary_hint: z.string().default(""),
  matrix: z.array(MatrixEntry).default([]),
});

export const PolishHighlightRequest = z.object({
  text: z.string().default(""),
  lang: Lang,
  context: z.string().optional(),
});

export const RenameProjectRequest = z.object({
  new_id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
});
