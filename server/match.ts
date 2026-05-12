import { listProjects, maxLevelForSkill, projectsForSkill } from "./db.ts";

export type MatrixEntry = {
  skill: string;
  level: number; // 0 if we have no project for this skill
  kind: "must" | "should";
  project_ids: string[]; // empty if no match
};

export function buildMatrix(args: {
  must_have: string[];
  should_have: string[];
  /** Optional cap. If omitted, all matching projects are returned, already
   *  ordered by (prio DESC, end_ym DESC) inside `projectsForSkill`. */
  maxProjectsPerSkill?: number;
}): MatrixEntry[] {
  const maxN = args.maxProjectsPerSkill;
  const seen = new Set<string>();
  const out: MatrixEntry[] = [];

  const push = (skill: string, kind: "must" | "should") => {
    const key = skill.trim();
    if (!key) return;
    const lower = key.toLowerCase();
    if (seen.has(lower)) return;
    seen.add(lower);
    const level = maxLevelForSkill(key);
    const all = projectsForSkill(key);
    const project_ids = maxN ? all.slice(0, maxN) : all;
    out.push({ skill: key, level, kind, project_ids });
  };

  for (const s of args.must_have) push(s, "must");
  for (const s of args.should_have) push(s, "should");
  return out;
}

/**
 * Decide which projects to include in the tailored CV body.
 *
 * Strategy: every 'high' prio project, plus any non-high project the matrix
 * references. Non-referenced medium/low projects are dropped — that's the
 * point of tailoring. Order preserved from listProjects() (recency-based).
 */
export function pickProjectsForRender(matrix: MatrixEntry[]): string[] {
  const referenced = new Set(matrix.flatMap((m) => m.project_ids));
  return listProjects()
    .filter((p) => p.prio === "high" || referenced.has(p.id))
    .map((p) => p.id);
}
