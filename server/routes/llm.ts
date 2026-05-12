import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { polishHighlight, suggestSkills, translate } from "../llm-assists.ts";
import {
  PolishHighlightRequest,
  SuggestSkillsRequest,
  SummaryGenerateRequest,
  TranslateRequest,
} from "../schema.ts";
import { tailoredSummary } from "../summary.ts";

export const llmRoutes = new Hono()
  .post("/translate", zValidator("json", TranslateRequest), async (c) => {
    const { text, from, to, context } = c.req.valid("json");
    const out = await translate({ text, from, to, context });
    return c.json({ text: out });
  })
  .post(
    "/suggest-skills",
    zValidator("json", SuggestSkillsRequest),
    async (c) => {
      const { highlights, existing_skills } = c.req.valid("json");
      const cleanHighlights = highlights.filter((s) => s.trim().length > 0);
      const skills = await suggestSkills({
        highlights: cleanHighlights,
        existingSkills: existing_skills,
      });
      return c.json({ skills });
    },
  )
  .post("/summary", zValidator("json", SummaryGenerateRequest), async (c) => {
    const { lang, role_title, summary_hint, matrix } = c.req.valid("json");
    const out = await tailoredSummary({
      lang,
      role_title,
      matrix,
      summary_hint,
    });
    return c.json({ summary: out.summary });
  })
  .post(
    "/polish-highlight",
    zValidator("json", PolishHighlightRequest),
    async (c) => {
      const { text, lang, context } = c.req.valid("json");
      const out = await polishHighlight({ text, lang, context });
      return c.json({ text: out });
    },
  );
