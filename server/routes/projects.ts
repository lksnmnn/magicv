import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  deleteProject as dbDeleteProject,
  getProject,
  listProjects,
  renameProject,
  upsertProject,
} from "../db.ts";
import { Project, RenameProjectRequest } from "../schema.ts";

export const projectRoutes = new Hono()
  .get("/", (c) => c.json(listProjects()))
  .get("/:id", (c) => {
    const p = getProject(c.req.param("id"));
    if (!p) return c.json({ error: "not found" }, 404);
    return c.json(p);
  })
  .post("/", zValidator("json", Project), (c) => {
    const parsed = c.req.valid("json");
    if (getProject(parsed.id)) {
      return c.json({ error: "project id already exists" }, 409);
    }
    upsertProject(parsed);
    return c.json(getProject(parsed.id), 201);
  })
  .put("/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const parsed = Project.parse({ ...body, id });
    upsertProject(parsed);
    return c.json(getProject(id));
  })
  .patch("/:id/rename", zValidator("json", RenameProjectRequest), (c) => {
    const oldId = c.req.param("id");
    const { new_id: newId } = c.req.valid("json");
    if (!getProject(oldId)) {
      return c.json({ error: "project not found" }, 404);
    }
    if (newId === oldId) {
      return c.json(getProject(oldId));
    }
    if (getProject(newId)) {
      return c.json({ error: "id already in use" }, 409);
    }
    renameProject(oldId, newId);
    return c.json(getProject(newId));
  })
  .delete("/:id", (c) => {
    dbDeleteProject(c.req.param("id"));
    return c.json({ ok: true });
  });
