import { chromium, type Browser } from "playwright";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { getProfile, getProject, listProjects } from "./db.ts";
import type { Lang, Project } from "./schema.ts";
import type { MatrixEntry } from "./match.ts";
import { renderHtml } from "../templates/cv.html.ts";

const ROOT = resolve(import.meta.dir, "..");
const OUT_DIR = resolve(ROOT, "out");
mkdirSync(OUT_DIR, { recursive: true });

// Cache the browser across renders — chromium startup is ~1–2s.
let cachedBrowser: Promise<Browser> | null = null;
function getBrowser(): Promise<Browser> {
  if (!cachedBrowser) cachedBrowser = chromium.launch({ headless: true });
  return cachedBrowser;
}

function lookupProjectLinks(
  ids: string[],
  lang: Lang,
): { id: string; title: string }[] {
  return ids.map((id) => {
    const p = getProject(id);
    const title = !p ? id : lang === "de" ? p.title_de : p.title_en;
    return { id, title };
  });
}

export type RenderInput = {
  lang: Lang;
  role_title: string;
  summary: string;
  matrix: MatrixEntry[];
  project_ids: string[];
};

export type RenderResult = {
  pdf: Buffer;
  pdfPath: string;
  thumbPath: string;
  htmlPath: string;
  slug: string;
};

/**
 * Post-process the PDF with Ghostscript to shrink + linearize, when available.
 * Chrome's headless PDF is verbose (~700–800 KB for this CV); gs `/ebook`
 * typically gets it to ~130 KB while keeping the photo readable. No-op if
 * `gs` isn't on PATH or the compressed version isn't smaller than the input.
 *
 * Override the preset via `MAGICV_PDF_PRESET` (default `/ebook`). Other useful
 * values: `/screen` (smallest), `/printer` (high quality), `/prepress` (lossless-ish).
 */
function maybeCompressPdf(pdfPath: string): { before: number; after: number } {
  const before = statSync(pdfPath).size;
  const which = spawnSync("which", ["gs"], { encoding: "utf8" });
  if (which.status !== 0) return { before, after: before };

  const preset = process.env.MAGICV_PDF_PRESET || "/ebook";
  const tmp = pdfPath + ".tmp";
  const r = spawnSync(
    "gs",
    [
      "-dNOPAUSE",
      "-dBATCH",
      "-dQUIET",
      "-sDEVICE=pdfwrite",
      `-dPDFSETTINGS=${preset}`,
      "-dCompatibilityLevel=1.5",
      "-dDetectDuplicateImages=true",
      "-dCompressFonts=true",
      "-dFastWebView=true", // linearize for fast incremental loading
      "-sOutputFile=" + tmp,
      pdfPath,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    try {
      unlinkSync(tmp);
    } catch {}
    return { before, after: before };
  }
  const after = statSync(tmp).size;
  if (after > 0 && after < before) {
    renameSync(tmp, pdfPath);
    return { before, after };
  }
  try {
    unlinkSync(tmp);
  } catch {}
  return { before, after: before };
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "cv"
  );
}

export async function render(input: RenderInput): Promise<RenderResult> {
  const profile = getProfile();
  // listProjects() already returns rows ordered by (end_ym DESC, start_ym DESC).
  // Filter to the selected set while preserving that chronological order,
  // so the rendered timeline is always newest-first regardless of how
  // project_ids was assembled client-side.
  const all = listProjects();
  const wanted = new Set(input.project_ids);
  const chosen: Project[] = all.filter((p) => wanted.has(p.id));

  const enrichedMatrix = input.matrix.map((m) => ({
    skill: m.skill,
    level: m.level,
    kind: m.kind,
    project_ids: m.project_ids,
    project_links: lookupProjectLinks(m.project_ids, input.lang),
  }));

  const html = renderHtml({
    lang: input.lang,
    profile,
    projects: chosen,
    matrix: enrichedMatrix,
    summary: input.summary,
    role_title: input.role_title,
  });

  const browser = await getBrowser();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `<div style="width:100%;font-size:7.5pt;color:#888;padding:0 16mm 0 0;text-align:right;font-family:Helvetica,Arial,sans-serif;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
    });
    const slug = slugify(input.role_title || "cv");
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const base = `${slug}-${input.lang}-${stamp}`;
    const pdfPath = resolve(OUT_DIR, `${base}.pdf`);
    writeFileSync(pdfPath, pdf);
    const { before, after } = maybeCompressPdf(pdfPath);
    if (after < before) {
      console.log(
        `[render] compressed ${base}.pdf: ${(before / 1024).toFixed(0)} → ${(after / 1024).toFixed(0)} KB`,
      );
    }

    const htmlPath = resolve(OUT_DIR, `${base}.html`);
    writeFileSync(htmlPath, html, "utf8");

    const thumbPath = resolve(OUT_DIR, `${base}.thumb.png`);
    await page.setViewportSize({ width: 794, height: 1123 }); // A4 @ 96dpi
    const thumb = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: 794, height: 1123 },
    });
    writeFileSync(thumbPath, thumb);

    // Re-read the (possibly compressed) PDF so the response buffer matches disk.
    const finalPdf = Buffer.from(readFileSync(pdfPath));
    return { pdf: finalPdf, pdfPath, thumbPath, htmlPath, slug };
  } finally {
    await ctx.close();
  }
}
