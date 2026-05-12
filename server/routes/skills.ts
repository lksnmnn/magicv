import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { bulkAddSkill, listSkills } from "../db.ts";
import { buildMatrix, pickProjectsForRender } from "../match.ts";
import { BulkAddSkillsRequest, MatchRequest } from "../schema.ts";

export const skillRoutes = new Hono()
  .get("/skills", (c) => c.json(listSkills()))
  .post("/skills/bulk-add", zValidator("json", BulkAddSkillsRequest), (c) => {
    const { skill, level, project_ids } = c.req.valid("json");
    const n = bulkAddSkill(skill.trim(), level, project_ids);
    return c.json({ added_to: n });
  })
  // Lightweight match rebuild used after the user adds a missing skill to
  // projects, so the matrix refreshes without paying for another extract.
  .post("/match", zValidator("json", MatchRequest), (c) => {
    const { must_have, should_have } = c.req.valid("json");
    const matrix = buildMatrix({ must_have, should_have });
    const project_ids = pickProjectsForRender(matrix);
    return c.json({ matrix, project_ids });
  });
