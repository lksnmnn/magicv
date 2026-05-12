import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getProfile, listProjects, recordRun } from "../db.ts";
import { render } from "../render.ts";
import { RenderRequest } from "../schema.ts";

export const renderRoutes = new Hono()
  // HTML preview without Playwright; used for fast in-app iteration.
  .post("/preview", zValidator("json", RenderRequest), async (c) => {
    const req = c.req.valid("json");
    const { renderHtml } = await import("../../templates/cv.html.ts");
    const profile = getProfile();
    const all = listProjects();
    const byId = new Map(all.map((p) => [p.id, p]));
    // Preserve chronological order from listProjects() regardless of the
    // order in which client-side toggles populated project_ids.
    const wanted = new Set(req.project_ids);
    const chosen = all.filter((p) => wanted.has(p.id));
    const enrichedMatrix = req.matrix
      .filter((m) => m.included !== false)
      .map((m) => ({
        skill: m.skill,
        level: m.level,
        kind: m.kind,
        project_ids: m.project_ids,
        project_links: m.project_ids.map((id) => {
          const p = byId.get(id);
          const t = !p ? id : req.lang === "de" ? p.title_de : p.title_en;
          return { id, title: t };
        }),
      }));
    const html = renderHtml({
      lang: req.lang,
      profile,
      projects: chosen,
      matrix: enrichedMatrix,
      summary: req.summary,
      role_title: req.role_title,
    });
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  })
  // Full PDF render via Playwright, recorded into tailored_runs.
  .post("/render", zValidator("json", RenderRequest), async (c) => {
    const req = c.req.valid("json");
    // Server-side filter so the client can send the full matrix (with
    // `included` toggles), letting a re-opened run restore the state.
    const renderMatrix = req.matrix.filter((m) => m.included !== false);
    const result = await render({
      lang: req.lang,
      role_title: req.role_title,
      summary: req.summary,
      matrix: renderMatrix,
      project_ids: req.project_ids,
    });

    recordRun({
      lang: req.lang,
      slug: result.slug,
      role_title: req.role_title,
      jd_text: req.jd_text,
      summary: req.summary,
      matrix_json: JSON.stringify(req.matrix),
      project_ids_json: JSON.stringify(req.project_ids),
      run_group_id: req.group_id,
      pdf_path: result.pdfPath,
      thumb_path: result.thumbPath,
      html_path: result.htmlPath,
    });

    return new Response(new Uint8Array(result.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.slug}-${req.lang}.pdf"`,
        "X-Pdf-Path": result.pdfPath,
      },
    });
  });
