import { Hono } from "hono";
import { readFile, unlink } from "node:fs/promises";
import {
  deleteAllRuns,
  deleteRun,
  getRun,
  getRunFiles,
  listRuns,
} from "../db.ts";

async function unlinkIgnoringMissing(paths: (string | null | undefined)[]) {
  await Promise.all(
    paths
      .filter((p): p is string => Boolean(p))
      .map((p) => unlink(p).catch(() => {})),
  );
}

export const runRoutes = new Hono()
  .get("/", (c) => c.json(listRuns()))
  .get("/:id/full", (c) => {
    const id = Number(c.req.param("id"));
    const r = getRun(id);
    if (!r) return c.json({ error: "not found" }, 404);
    return c.json({
      id: r.id,
      created_at: r.created_at,
      lang: r.lang,
      slug: r.slug,
      role_title: r.role_title,
      run_group_id: r.run_group_id,
      jd_text: r.jd_text,
      summary: r.summary,
      matrix: JSON.parse(r.matrix_json),
      project_ids: JSON.parse(r.project_ids_json || "[]"),
    });
  })
  .delete("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const files = getRunFiles(id);
    deleteRun(id);
    if (files) await unlinkIgnoringMissing([files.pdf, files.thumb]);
    return c.json({ ok: true });
  })
  .delete("/", async (c) => {
    const { paths } = deleteAllRuns();
    await unlinkIgnoringMissing(paths);
    return c.json({ ok: true, deleted: paths.length });
  })
  .get("/:id/html", async (c) => {
    const target = Number(c.req.param("id"));
    const row = (
      listRuns(1000) as Array<{ id: number; html_path: string }>
    ).find((r) => r.id === target);
    if (!row?.html_path) return c.json({ error: "no html" }, 404);
    try {
      const buf = await readFile(row.html_path);
      return new Response(new Uint8Array(buf), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        return c.json({ error: "html missing on disk" }, 404);
      }
      throw e;
    }
  })
  .get("/:id/thumb", async (c) => {
    const target = Number(c.req.param("id"));
    const row = (
      listRuns(1000) as Array<{ id: number; thumb_path: string }>
    ).find((r) => r.id === target);
    if (!row?.thumb_path) return c.json({ error: "no thumbnail" }, 404);
    try {
      const buf = await readFile(row.thumb_path);
      return new Response(new Uint8Array(buf), {
        headers: { "Content-Type": "image/png", "Cache-Control": "no-cache" },
      });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        return c.json({ error: "thumbnail missing on disk" }, 404);
      }
      throw e;
    }
  })
  .get("/:id/pdf", async (c) => {
    const target = Number(c.req.param("id"));
    const row = (
      listRuns(1000) as Array<{ id: number; pdf_path: string }>
    ).find((r) => r.id === target);
    if (!row?.pdf_path) return c.json({ error: "run not found" }, 404);
    try {
      const buf = await readFile(row.pdf_path);
      return new Response(new Uint8Array(buf), {
        headers: { "Content-Type": "application/pdf" },
      });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        return c.json(
          { error: `pdf file missing on disk: ${row.pdf_path}` },
          404,
        );
      }
      throw e;
    }
  });
