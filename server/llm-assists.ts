/**
 * LLM helpers for UI-level AI assists: translate, suggest skills, polish bullet.
 * All use the existing `claude -p --json-schema` plumbing in llm.ts.
 */
import { z } from "zod";
import { llmStructured } from "./llm.ts";
import { listSkills } from "./db.ts";

// ---- Translate ----------------------------------------------------------

const TranslateOut = z.object({ text: z.string() });

const TRANSLATE_SCHEMA = {
  type: "object",
  required: ["text"],
  additionalProperties: false,
  properties: {
    text: {
      type: "string",
      description:
        "The translated text. Preserve names, companies, and tech terms verbatim.",
    },
  },
};

export async function translate(args: {
  text: string;
  from: "de" | "en";
  to: "de" | "en";
  context?: string;
}): Promise<string> {
  if (!args.text.trim()) return "";
  if (args.from === args.to) return args.text;
  const fromName = args.from === "de" ? "German" : "English";
  const toName = args.to === "de" ? "German" : "English";
  const prompt = `Translate the following ${fromName} text into ${toName}, in a tone suited to a professional CV.

Rules:
- Preserve product names, company names, framework names, and tech jargon verbatim.
- Keep numbers and units identical (e.g. "20 %", "100.000 Zuschauer" → "100,000 viewers").
- Match the formality and verb voice of the source.
- Do not add commentary. Do not wrap in quotes.
${args.context ? `\nSurrounding context for terminology consistency:\n${args.context}\n` : ""}
Source (${fromName}):
"""
${args.text}
"""`;

  const out = await llmStructured(prompt, TRANSLATE_SCHEMA, TranslateOut);
  return out.text;
}

// ---- Suggest skills from highlights -------------------------------------

const SuggestSkillsOut = z.object({
  skills: z.array(
    z.object({
      skill: z.string().min(1),
      level: z.number().int().min(1).max(4),
    }),
  ),
});

const SUGGEST_SCHEMA = {
  type: "object",
  required: ["skills"],
  additionalProperties: false,
  properties: {
    skills: {
      type: "array",
      items: {
        type: "object",
        required: ["skill", "level"],
        additionalProperties: false,
        properties: {
          skill: { type: "string", description: "Canonical skill name" },
          level: {
            type: "integer",
            minimum: 1,
            maximum: 4,
            description: "Proposed proficiency 1-4",
          },
        },
      },
    },
  },
};

export async function suggestSkills(args: {
  highlights: string[];
  existingSkills: string[];
}): Promise<{ skill: string; level: 1 | 2 | 3 | 4 }[]> {
  if (args.highlights.length === 0) return [];
  const canonical = listSkills()
    .map((s) => s.skill)
    .join(", ");
  const prompt = `You read the highlights of a CV project and propose additional skills that are clearly demonstrated by them.

Rules:
- Only emit hard skills, technologies, frameworks, platforms, or methodologies — no soft skills.
- Prefer skills from the canonical list. If a clearly-used tech is missing from the list, propose it.
- Do NOT re-propose skills already in "existing_skills".
- Propose a proficiency level 1–4 (1 familiar, 2 proficient, 3 advanced, 4 expert) based on how prominent the skill is in the highlights.
- Maximum 8 suggestions. Quality over quantity.
- Return JSON matching the schema.

Canonical skills:
${canonical}

Existing skills on this project (do not repeat):
${args.existingSkills.join(", ") || "(none)"}

Highlights:
${args.highlights.map((h, i) => `${i + 1}. ${h}`).join("\n")}`;

  const out = await llmStructured(prompt, SUGGEST_SCHEMA, SuggestSkillsOut);
  return out.skills as { skill: string; level: 1 | 2 | 3 | 4 }[];
}

// ---- Polish a single highlight bullet -----------------------------------

const PolishOut = z.object({ text: z.string() });

const POLISH_SCHEMA = {
  type: "object",
  required: ["text"],
  additionalProperties: false,
  properties: {
    text: {
      type: "string",
      description: "Polished bullet, one sentence, impact-oriented.",
    },
  },
};

export async function polishHighlight(args: {
  text: string;
  lang: "de" | "en";
  context?: string;
}): Promise<string> {
  if (!args.text.trim()) return args.text;
  const langName = args.lang === "de" ? "German" : "English";
  const prompt = `Rewrite the following CV bullet point in ${langName} so it reads as a tight, impact-oriented statement.

Rules:
- One sentence. Active voice. Past tense when describing completed work, present when describing ongoing.
- Lead with the impact / outcome, follow with the mechanism (what you did).
- Preserve every concrete fact, number, technology, and named entity from the source. Do NOT invent or inflate numbers.
- If no measurable impact is mentioned, do not fabricate one — just tighten the wording.
- Keep it CV-grade: factual, not marketing-fluff.
- Return JSON with just the polished text.
${args.context ? `\nContext (other bullets in same project):\n${args.context}\n` : ""}
Source bullet:
"""
${args.text}
"""`;

  const out = await llmStructured(prompt, POLISH_SCHEMA, PolishOut);
  return out.text;
}
