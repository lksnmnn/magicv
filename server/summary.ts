import { SummaryOut, type SummaryOut as SummaryOutT } from "./schema.ts";
import { llmStructured } from "./llm.ts";
import { getProfile } from "./db.ts";
import type { MatrixEntry } from "./match.ts";

const SCHEMA = {
  type: "object",
  required: ["summary"],
  additionalProperties: false,
  properties: {
    summary: {
      type: "string",
      description:
        "Tailored executive summary, 1 to 3 sentences, single paragraph, no line breaks.",
    },
  },
};

const LEVEL_NAME = [
  "",
  "familiar with",
  "proficient in",
  "advanced in",
  "expert in",
];

export async function tailoredSummary(args: {
  lang: "de" | "en";
  role_title: string;
  /** The post-match skill matrix. Each entry's `level` tells the prompt
   *  whether the candidate actually has the skill (1–4) or not (0). The
   *  prompt forbids claiming any skill at level 0. */
  matrix: MatrixEntry[];
  summary_hint: string;
}): Promise<SummaryOutT> {
  const profile = getProfile();
  const langName = args.lang === "de" ? "German" : "English";
  const fullName = profile.name || "the candidate";
  const langTone =
    args.lang === "de"
      ? `Formal German, third person ('${fullName} ist…'). Avoid 'wir', 'unser'.`
      : `Concise English, third person ('${fullName} is…').`;
  const anchor =
    args.lang === "de"
      ? profile.summary_default_de
      : profile.summary_default_en;

  // Split JD requirements into "I have it" vs "I don't have it" piles.
  const verified = args.matrix
    .filter((m) => m.level > 0)
    .toSorted((a, b) => b.level - a.level); // strongest first
  const gap = args.matrix.filter((m) => m.level === 0);

  const verifiedLines = verified.length
    ? verified
        .map(
          (m) =>
            `  - ${m.skill} — ${LEVEL_NAME[m.level] ?? "experienced in"} (kind: ${m.kind})`,
        )
        .join("\n")
    : "  (none — the candidate has zero matching skills on file)";

  const gapList = gap.length ? gap.map((m) => m.skill).join(", ") : "(none)";

  const prompt = `Write a tailored CV executive summary for ${profile.name}, in ${langName}.

Constraints:
- 1 to 3 sentences, single paragraph, no line breaks.
- ${langTone}
- Reference the engagement's focus naturally; do not literally quote the role title.
- **Truthfulness is non-negotiable.** Only mention skills/technologies the candidate is verified to have (see "Verified skills" below). Do NOT claim experience in anything on the "Gap skills" list. It is fine, even preferable, to omit must-have skills the candidate doesn't have, rather than fudge.
- Pick 2–4 verified skills that matter most for this engagement; do not list everything.
${anchor ? `- Anchor claims in the candidate's biographical baseline below. Do not invent numbers, clients, or outcomes beyond what it states.` : `- Do not invent numbers, clients, or outcomes.`}
- No emojis, no marketing fluff, no first person.

Target role: ${args.role_title || "(unspecified)"}
Engagement focus hint: ${args.summary_hint || "(none)"}
${anchor ? `\nCandidate's biographical baseline (anchor claims here, do not exceed it):\n"""\n${anchor}\n"""\n` : ""}
Verified skills the candidate has, ranked strongest-first (you MAY use these):
${verifiedLines}

Gap skills the JD wants but candidate does NOT have (you MUST NOT claim any of these as experience):
  ${gapList}

Return JSON matching the schema.`;

  return llmStructured(prompt, SCHEMA, SummaryOut);
}
