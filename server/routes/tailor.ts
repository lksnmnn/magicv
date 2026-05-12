import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { extractSkills } from "../extract.ts";
import { buildMatrix, pickProjectsForRender } from "../match.ts";
import { TailorRequest } from "../schema.ts";
import { tailoredSummary } from "../summary.ts";

export const tailorRoutes = new Hono().post(
  "/",
  zValidator("json", TailorRequest),
  async (c) => {
    const { jd_text, lang } = c.req.valid("json");

    const extract = await extractSkills(jd_text, lang);
    const matrix = buildMatrix({
      must_have: extract.must_have,
      should_have: extract.should_have,
      maxProjectsPerSkill: 3,
    });
    const project_ids = pickProjectsForRender(matrix);
    const summary = await tailoredSummary({
      lang,
      role_title: extract.role_title,
      matrix,
      summary_hint: extract.summary_hint,
    });

    return c.json({
      role_title: extract.role_title,
      summary_hint: extract.summary_hint,
      must_have: extract.must_have,
      should_have: extract.should_have,
      matrix,
      project_ids,
      summary: summary.summary,
    });
  },
);
