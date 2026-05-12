export type Skill = { skill: string; level: 1 | 2 | 3 | 4 };
export type Quote = { id?: number; text: string; author: string; role: string };
type Prio = "high" | "medium" | "low";

export type HighlightPair = { de: string; en: string };

export type Project = {
  id: string;
  role_de: string;
  role_en: string;
  title_de: string;
  title_en: string;
  via: string;
  url: string;
  industry_de: string;
  industry_en: string;
  start_ym: string;
  end_ym: string;
  team_size: number | null;
  prio: Prio;
  is_personal: boolean;
  github_url: string;
  highlights: HighlightPair[];
  skills: Skill[];
  quotes: Quote[];
};

export type Profile = {
  name: string;
  title_de: string;
  title_en: string;
  email: string;
  phone: string;
  location_de: string;
  location_en: string;
  linkedin: string;
  github: string;
  photo_path: string;
  languages: {
    name_de: string;
    name_en: string;
    level_de: string;
    level_en: string;
  }[];
  education: {
    degree_de: string;
    degree_en: string;
    school: string;
    year: number;
  }[];
  hobbies_intro_de: string;
  hobbies_intro_en: string;
  hobbies_de: string[];
  hobbies_en: string[];
  summary_default_de: string;
  summary_default_en: string;
  featured_skills: string[];
};

export type SkillAggregate = {
  skill: string;
  max_level: number;
  count: number;
};

export type MatrixEntry = {
  skill: string;
  level: number;
  kind: "must" | "should";
  project_ids: string[];
  /** UI-only: false hides this row from the rendered PDF. Defaults to true
   *  (absent in server responses). Filtered out client-side before render. */
  included?: boolean;
};

export type TailorResponse = {
  role_title: string;
  summary_hint: string;
  must_have: string[];
  should_have: string[];
  matrix: MatrixEntry[];
  project_ids: string[];
  summary: string;
};

export type Run = {
  id: number;
  created_at: string;
  lang: "de" | "en";
  slug: string;
  role_title: string;
  run_group_id: string;
  pdf_path: string;
  thumb_path: string;
  html_path: string;
};

export type FieldIssue = { path: string; message: string };

/** Thrown for any non-2xx response. When the body is a zod-validator failure
 *  (shape `{ success: false, error: { issues: [...] } }`), `issues` is the
 *  flattened per-field list with dotted paths; otherwise it's empty. */
export class ApiError extends Error {
  status: number;
  issues: FieldIssue[];
  constructor(status: number, message: string, issues: FieldIssue[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    let issues: FieldIssue[] = [];
    try {
      const body = JSON.parse(text) as {
        success?: boolean;
        error?: { issues?: { path?: (string | number)[]; message?: string }[] };
      };
      if (body?.success === false && Array.isArray(body.error?.issues)) {
        issues = body.error.issues
          .filter((i) => typeof i.message === "string")
          .map((i) => ({
            path: (i.path ?? []).map(String).join("."),
            message: i.message!,
          }));
      }
    } catch {
      /* response body wasn't JSON; leave issues empty */
    }
    const summary = issues[0]?.message ?? text;
    throw new ApiError(res.status, `${res.status}: ${summary}`, issues);
  }
  return res.json() as Promise<T>;
}

/** Flatten an ApiError's issues into a `{ "path": "message" }` map.
 *  First message wins per path. Non-ApiError input yields an empty map. */
export function fieldErrorMap(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError)) return {};
  const out: Record<string, string> = {};
  for (const i of err.issues) if (!(i.path in out)) out[i.path] = i.message;
  return out;
}

export const api = {
  profile: {
    get: () => fetch("/api/profile").then(json<Profile>),
    put: (p: Profile) =>
      fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      }).then(json<Profile>),
    uploadPhoto: (file: File) => {
      const form = new FormData();
      form.append("photo", file);
      return fetch("/api/profile/photo", { method: "POST", body: form }).then(
        json<Profile>,
      );
    },
  },
  projects: {
    list: () => fetch("/api/projects").then(json<Project[]>),
    get: (id: string) => fetch(`/api/projects/${id}`).then(json<Project>),
    create: (p: Project) =>
      fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      }).then(json<Project>),
    update: (id: string, p: Project) =>
      fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      }).then(json<Project>),
    delete: (id: string) =>
      fetch(`/api/projects/${id}`, { method: "DELETE" }).then(
        json<{ ok: true }>,
      ),
    rename: (oldId: string, newId: string) =>
      fetch(`/api/projects/${oldId}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_id: newId }),
      }).then(json<Project>),
  },
  skills: () => fetch("/api/skills").then(json<SkillAggregate[]>),
  bulkAddSkill: (skill: string, level: number, project_ids: string[]) =>
    fetch("/api/skills/bulk-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill, level, project_ids }),
    }).then(json<{ added_to: number }>),
  rebuildMatrix: (must_have: string[], should_have: string[]) =>
    fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ must_have, should_have }),
    }).then(json<{ matrix: MatrixEntry[]; project_ids: string[] }>),
  llm: {
    translate: (
      text: string,
      from: "de" | "en",
      to: "de" | "en",
      context?: string,
    ) =>
      fetch("/api/llm/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, from, to, context }),
      }).then(json<{ text: string }>),
    suggestSkills: (highlights: string[], existing: string[]) =>
      fetch("/api/llm/suggest-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlights, existing_skills: existing }),
      }).then(json<{ skills: Skill[] }>),
    polishHighlight: (text: string, lang: "de" | "en", context?: string) =>
      fetch("/api/llm/polish-highlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang, context }),
      }).then(json<{ text: string }>),
    summary: (args: {
      lang: "de" | "en";
      role_title: string;
      summary_hint: string;
      matrix: MatrixEntry[];
    }) =>
      fetch("/api/llm/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      }).then(json<{ summary: string }>),
  },
  tailor: (jd_text: string, lang: "de" | "en") =>
    fetch("/api/tailor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jd_text, lang }),
    }).then(json<TailorResponse>),
  previewUrl: (body: {
    lang: "de" | "en";
    role_title: string;
    summary: string;
    matrix: MatrixEntry[];
    project_ids: string[];
    jd_text: string;
  }) => {
    // Returns an iframe-friendly URL. Uses a blob URL after POSTing the body.
    return fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
        return r.blob();
      })
      .then((blob) => URL.createObjectURL(blob));
  },
  render: async (body: {
    lang: "de" | "en";
    role_title: string;
    summary: string;
    matrix: MatrixEntry[];
    project_ids: string[];
    jd_text: string;
    group_id?: string;
  }) => {
    const res = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    return res.blob();
  },
  runs: () => fetch("/api/runs").then(json<Run[]>),
  runFull: (id: number) =>
    fetch(`/api/runs/${id}/full`).then(
      json<{
        id: number;
        created_at: string;
        lang: "de" | "en";
        slug: string;
        role_title: string;
        run_group_id: string;
        jd_text: string;
        summary: string;
        matrix: MatrixEntry[];
        project_ids: string[];
      }>,
    ),
  deleteRun: (id: number) =>
    fetch(`/api/runs/${id}`, { method: "DELETE" }).then(json<{ ok: true }>),
  deleteAllRuns: () =>
    fetch("/api/runs", { method: "DELETE" }).then(
      json<{ ok: true; deleted: number }>,
    ),
};

export function blankProject(): Project {
  return {
    id: "",
    role_de: "",
    role_en: "",
    title_de: "",
    title_en: "",
    via: "",
    url: "",
    industry_de: "",
    industry_en: "",
    start_ym: new Date().toISOString().slice(0, 7),
    end_ym: "present",
    team_size: null,
    prio: "medium",
    is_personal: false,
    github_url: "",
    highlights: [],
    skills: [],
    quotes: [],
  };
}

/** Direct-download a Blob URL that's already created. Caller manages revoke. */
export function downloadUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ---- Filename helpers ----

// Words to strip from a role title when building the file-name suffix.
// Generic seniority/job-category fluff that adds no info to the filename.
const FLUFF = new Set([
  // English
  "senior",
  "junior",
  "mid",
  "midlevel",
  "lead",
  "staff",
  "principal",
  "developer",
  "engineer",
  "architect",
  "programmer",
  "consultant",
  "specialist",
  "freelance",
  "freelancer",
  "contractor",
  "fullstack",
  "full",
  "stack",
  "cv",
  "curriculum",
  "vitae",
  "resume",
  // German
  "entwickler",
  "entwicklerin",
  "freiberufler",
  "festanstellung",
  "lebenslauf",
  // Job-ad noise
  "mwd",
  "fmd",
  "mfd",
]);

/** Pull the distinctive words out of a role title.
 *
 *    "Senior Angular Frontend Entwickler" → "Angular_Frontend"
 *    "Senior Angular UX Engineer (m/w/d)" → "Angular_UX"
 *    "Lebenslauf" / "CV"                  → ""        (default CV → no role)
 */
function shortRoleSlug(role: string): string {
  if (!role) return "";
  const words = role
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[(){}[\]]/g, " ")
    // Split on common separators incl. middle dot, slash, hyphen, comma, etc.
    .split(/[\s/\-_,.·•|&+]+/)
    .filter(Boolean)
    .filter((w) => w.length >= 2) // drops "m/w/d" remnants, single letters
    .filter((w) => !/^\d+$/.test(w))
    .filter((w) => !FLUFF.has(w.toLowerCase()));
  return words
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("_");
}

/** Build the user-facing download filename per spec:
 *    Firstname_Lastname_CV_2026.pdf              (default DE)
 *    Firstname_Lastname_CV_2026_EN.pdf           (default EN)
 *    Firstname_Lastname_CV_Angular_UX_2026.pdf   (tailored DE)
 *    Firstname_Lastname_CV_Angular_UX_2026_EN.pdf (tailored EN)
 */
export function displayFilename(
  name: string,
  lang: "de" | "en",
  roleTitle: string,
): string {
  const nameSlug =
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .join("_") || "CV";
  const role = shortRoleSlug(roleTitle);
  const year = new Date().getFullYear();
  const langSuffix = lang === "en" ? "_EN" : "";
  return role
    ? `${nameSlug}_CV_${role}_${year}${langSuffix}.pdf`
    : `${nameSlug}_CV_${year}${langSuffix}.pdf`;
}
