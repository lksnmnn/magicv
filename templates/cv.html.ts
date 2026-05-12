import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Lang, Profile, Project } from "../server/schema.ts";
import type { MatrixEntry } from "../server/match.ts";

const ROOT = resolve(import.meta.dir, "..");

// --- Asset helpers --------------------------------------------------------

function dataUrl(absPath: string, mime: string): string {
  const buf = readFileSync(absPath);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function svgDataUrl(absPath: string): string {
  // Inline as utf-8 data URL so the SVG is human-readable in the source.
  const content = readFileSync(absPath, "utf8");
  return `data:image/svg+xml;utf8,${encodeURIComponent(content)}`;
}

function loadIcon(name: string): string {
  return svgDataUrl(resolve(ROOT, "assets", "icons", `${name}.svg`));
}

const ASSETS_DIR = resolve(ROOT, "assets");

function loadPhoto(profile: Profile): string {
  const p = profile.photo_path || "assets/profile_placeholder.svg";
  const abs = resolve(ROOT, p);
  // Defense in depth: schema already constrains photo_path, but re-check that
  // the resolved path is inside ./assets/ so a stale DB row from before the
  // constraint can't read outside the repo.
  if (abs !== ASSETS_DIR && !abs.startsWith(ASSETS_DIR + "/")) {
    return svgDataUrl(resolve(ASSETS_DIR, "profile_placeholder.svg"));
  }
  const ext = abs.toLowerCase().split(".").pop();
  if (ext === "svg") return svgDataUrl(abs);
  const mime =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return dataUrl(abs, mime);
}

// --- Formatting ----------------------------------------------------------

const MONTHS_DE: Record<string, string> = {
  "01": "Jan.",
  "02": "Feb.",
  "03": "Mär.",
  "04": "Apr.",
  "05": "Mai",
  "06": "Jun.",
  "07": "Jul.",
  "08": "Aug.",
  "09": "Sep.",
  "10": "Okt.",
  "11": "Nov.",
  "12": "Dez.",
};
const MONTHS_EN: Record<string, string> = {
  "01": "Jan",
  "02": "Feb",
  "03": "Mar",
  "04": "Apr",
  "05": "May",
  "06": "Jun",
  "07": "Jul",
  "08": "Aug",
  "09": "Sep",
  "10": "Oct",
  "11": "Nov",
  "12": "Dec",
};

function formatPeriod(start: string, end: string, lang: Lang): string {
  const months = lang === "de" ? MONTHS_DE : MONTHS_EN;
  const parse = (ym: string): string => {
    if (ym === "present") return lang === "de" ? "heute" : "Present";
    const [y, m] = ym.split("-");
    if (!y || !m) return ym;
    return `${months[m] ?? m} ${y}`;
  };
  return `${parse(start)} – ${parse(end)}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// index 0 is the "skill is in the JD but I don't yet use it on any project"
// case. Showing it explicitly is more honest than rendering a blank cell.
const LEVEL_LABELS_DE = [
  "Lernbereit",
  "Grundkenntnisse",
  "Fortgeschritten",
  "Sehr gut",
  "Experte",
];
const LEVEL_LABELS_EN = [
  "Open to learn",
  "Familiar",
  "Proficient",
  "Advanced",
  "Expert",
];

function levelLabel(level: number, lang: Lang): string {
  const labels = lang === "de" ? LEVEL_LABELS_DE : LEVEL_LABELS_EN;
  return labels[Math.max(0, Math.min(4, level))] ?? "";
}

function levelBar(level: number): string {
  let html = '<span class="bar">';
  for (let i = 1; i <= 4; i++) {
    html += `<span class="dot${i <= level ? " on" : ""}"></span>`;
  }
  html += "</span>";
  return html;
}

// --- Template ------------------------------------------------------------

export type RenderHtmlInput = {
  lang: Lang;
  profile: Profile;
  projects: Project[];
  matrix: (MatrixEntry & { project_links: { id: string; title: string }[] })[];
  summary: string;
  role_title: string;
};

export function renderHtml(input: RenderHtmlInput): string {
  const { lang, profile, projects, matrix, summary } = input;
  const t =
    lang === "de"
      ? {
          profile: "Profil",
          contact: "Kontakt",
          languages: "Sprachen",
          education: "Ausbildung",
          personalFallback: "Persönliches",
          experience: "Berufserfahrung",
          skillMatch: "Anforderungsabgleich",
          coreSkills: "Kernkompetenzen",
          skill: "Skill",
          level: "Stufe",
          usedIn: "Eingesetzt in",
          team: "Team",
          via: "via",
          personalProject: "Persönliches Projekt",
        }
      : {
          profile: "Profile",
          contact: "Contact",
          languages: "Languages",
          education: "Education",
          personalFallback: "Personal",
          experience: "Professional Experience",
          skillMatch: "Skill Match",
          coreSkills: "Core Skills",
          skill: "Skill",
          level: "Level",
          usedIn: "Used in",
          team: "Team",
          via: "via",
          personalProject: "Personal project",
        };

  const title = lang === "de" ? profile.title_de : profile.title_en;
  const location = lang === "de" ? profile.location_de : profile.location_en;
  const hobbies = lang === "de" ? profile.hobbies_de : profile.hobbies_en;
  const hobbiesIntro =
    lang === "de" ? profile.hobbies_intro_de : profile.hobbies_intro_en;
  const hobbiesTitle = hobbiesIntro || t.personalFallback;

  const hasMust = matrix.some((m) => m.kind === "must");
  const matrixTitle = hasMust ? t.skillMatch : t.coreSkills;

  const photoSrc = loadPhoto(profile);
  const ic = {
    mapPin: loadIcon("map-pin"),
    mail: loadIcon("mail"),
    phone: loadIcon("phone"),
    linkedin: loadIcon("linkedin"),
    github: loadIcon("github"),
  };

  // --- Sidebar --------------------------------------------------------
  const sidebarHtml = `
  <aside class="sidebar">
    <img class="photo" src="${photoSrc}" alt="${esc(profile.name)}" />

    <h3 class="sb-heading">${esc(t.contact)}</h3>
    <ul class="contact">
      <li><img src="${ic.mapPin}" alt="" />${esc(location)}</li>
      <li><img src="${ic.mail}" alt="" /><a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a></li>
      <li><img src="${ic.phone}" alt="" /><a href="tel:${esc(profile.phone.replace(/\s/g, ""))}">${esc(profile.phone)}</a></li>
      <li><img src="${ic.linkedin}" alt="" /><a href="https://${esc(profile.linkedin)}">${esc(profile.linkedin)}</a></li>
      <li><img src="${ic.github}" alt="" /><a href="https://${esc(profile.github)}">${esc(profile.github)}</a></li>
    </ul>

    <h3 class="sb-heading">${esc(t.languages)}</h3>
    <ul class="lang-list">
      ${profile.languages
        .map((l) => {
          const name = lang === "de" ? l.name_de : l.name_en;
          const lvl = lang === "de" ? l.level_de : l.level_en;
          return `<li><strong>${esc(name)}</strong><br /><span class="muted">${esc(lvl)}</span></li>`;
        })
        .join("")}
    </ul>

    <h3 class="sb-heading">${esc(t.education)}</h3>
    <ul class="edu-list">
      ${profile.education
        .map((e) => {
          const deg = lang === "de" ? e.degree_de : e.degree_en;
          return `<li><strong>${esc(deg)}</strong><br /><span class="muted">${esc(e.school)} · ${e.year}</span></li>`;
        })
        .join("")}
    </ul>

    ${
      hobbies.length > 0
        ? `<h3 class="sb-heading">${esc(hobbiesTitle)}</h3>
           <p class="hobbies">${esc(hobbies.join(" · "))}</p>`
        : ""
    }
  </aside>`;

  // --- Skill matrix ----------------------------------------------------
  const matrixHtml =
    matrix.length === 0
      ? ""
      : `
    <section class="matrix">
      <h2 class="section-heading">${esc(matrixTitle)}</h2>
      <table>
        <thead>
          <tr>
            <th>${esc(t.skill)}</th>
            <th>${esc(t.level)}</th>
            <th></th>
            <th>${esc(t.usedIn)}</th>
          </tr>
        </thead>
        <tbody>
          ${matrix
            .map((m) => {
              const projectLinks = m.project_links
                .map(
                  (p) => `<a href="#project-${esc(p.id)}">${esc(p.title)}</a>`,
                )
                .join(", ");
              const rowCls = m.level === 0 ? ' class="no-experience"' : "";
              return `<tr${rowCls}>
                <td class="skill ${m.kind}">${esc(m.skill)}</td>
                <td class="bar-cell">${levelBar(m.level)}</td>
                <td class="lvl-label">${esc(levelLabel(m.level, lang))}</td>
                <td class="used">${projectLinks || "–"}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </section>`;

  // Per-project skill list: matched-by-matrix first, then remaining by level
  // desc, capped. Without this, projects with long skill arrays drown out the
  // matched signal the reader actually cares about.
  const MAX_PROJECT_SKILLS = 10;
  const matrixSkillSet = new Set(matrix.map((m) => m.skill.toLowerCase()));

  // --- Project blocks --------------------------------------------------
  const projectsHtml = projects
    .map((p) => {
      const titleStr = lang === "de" ? p.title_de : p.title_en;
      const role = lang === "de" ? p.role_de : p.role_en;
      const industry = lang === "de" ? p.industry_de : p.industry_en;
      // Pick the language side of each paired highlight; drop empties.
      const highlights = (p.highlights ?? [])
        .map((h) => (lang === "de" ? h.de : h.en))
        .filter((s) => s.trim().length > 0);
      const meta: string[] = [];
      if (role) meta.push(esc(role));
      if (industry) meta.push(esc(industry));
      if (p.team_size && p.team_size > 0) meta.push(`${t.team} ${p.team_size}`);
      if (p.via) meta.push(`${t.via} ${esc(p.via)}`);

      const url = p.url
        ? `<a class="proj-url" href="${esc(p.url)}">${esc(p.url.replace(/^https?:\/\//, ""))}</a>`
        : "";

      const githubLink = p.github_url
        ? `<a class="proj-github" href="${esc(p.github_url)}"><img src="${ic.github}" alt="" />${esc(p.github_url.replace(/^https?:\/\/(www\.)?/, ""))}</a>`
        : "";

      const personalBadge = p.is_personal
        ? `<span class="personal-badge">${esc(t.personalProject)}</span>`
        : "";

      const quotesHtml = p.quotes
        .map((q) => {
          const attrib = q.role
            ? `${esc(q.author)}, ${esc(q.role)}`
            : esc(q.author);
          return `<blockquote class="quote">
            <p class="q-text">${esc(q.text)}</p>
            <p class="q-attrib">— ${attrib}</p>
          </blockquote>`;
        })
        .join("");

      const matched = p.skills.filter((s) =>
        matrixSkillSet.has(s.skill.toLowerCase()),
      );
      const unmatched = p.skills
        .filter((s) => !matrixSkillSet.has(s.skill.toLowerCase()))
        .toSorted((a, b) => b.level - a.level);
      const matchedKeys = new Set(matched.map((s) => s.skill.toLowerCase()));
      const filler = unmatched.slice(
        0,
        Math.max(0, MAX_PROJECT_SKILLS - matched.length),
      );
      const shown = [...matched, ...filler];
      const skillsLine = shown.length
        ? `<p class="proj-skills">${shown
            .map((s) => {
              const cls = matchedKeys.has(s.skill.toLowerCase())
                ? "matched"
                : "";
              return `<span class="${cls}">${esc(s.skill)}</span>`;
            })
            .join(" · ")}</p>`
        : "";

      return `
      <article class="project" id="project-${esc(p.id)}">
        <div class="date-rail">${esc(formatPeriod(p.start_ym, p.end_ym, lang))}</div>
        <div class="proj-body">
          <header class="proj-header">
            <h3 class="proj-title">${esc(titleStr)}${personalBadge}</h3>
            ${url}
            ${githubLink}
          </header>
          ${meta.length ? `<p class="proj-meta">${meta.join(" · ")}</p>` : ""}
          ${
            highlights.length
              ? `<ul class="proj-highlights">${highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>`
              : ""
          }
          ${quotesHtml}
          ${skillsLine}
        </div>
      </article>`;
    })
    .join("");

  // --- CSS ------------------------------------------------------------
  const css = `
  :root {
    --teal: #0f766e;
    --teal-bg: #f0fdfa;
    --text-dark: #222;
    --muted: #555;
    --soft: #666;
    --divider: #e5e7eb;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.45;
    color: var(--text-dark);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  a { color: inherit; }
  a[href^="http"], a[href^="mailto"], a[href^="tel"] { text-decoration: underline; }
  a[href^="#"] { text-decoration: none; }

  @page {
    size: A4;
    margin: 14mm 16mm;
  }
  @page :first {
    margin: 0;
  }

  /* First page: sidebar + main as one full-page grid.
   * The teal background is painted by an absolutely-positioned ::before so
   * it covers the FULL page height (including the strip at the bottom
   * Chrome reserves for the page-number footer, which the .sidebar element
   * itself doesn't extend into). */
  /* First page is a flexbox so its two children stretch to fill the
   * page height reliably (CSS Grid + min-height behaves erratically with
   * Chrome's print pagination). The teal sidebar background is painted by
   * a positioned ::before so it always covers the full .page-1 height,
   * regardless of where the sidebar text content actually ends. */
  .page-1 {
    display: flex;
    align-items: stretch;
    min-height: 100vh;
    page-break-after: always;
    position: relative;
  }
  .page-1::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 66mm;
    background: var(--teal-bg);
    z-index: 0;
  }
  .sidebar {
    width: 66mm;
    flex-shrink: 0;
    padding: 14mm 14mm 14mm 14mm;
    font-size: 8.5pt;
    position: relative;
    z-index: 1;
  }
  .main {
    flex: 1;
    min-width: 0; /* allow children (long URLs, tables) to shrink */
    position: relative;
    z-index: 1;
  }
  /* Long URLs / emails wrap rather than overflow the slimmer sidebar. */
  .sidebar .contact a { word-break: break-word; }
  .sidebar .photo {
    width: 36mm; height: 36mm;
    object-fit: cover;
    border-radius: 8px;
    display: block;
    margin: 0 0 12px 0;
  }
  .sb-heading {
    font-size: 9pt;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--teal);
    margin: 18px 0 6px;
  }
  .contact, .lang-list, .edu-list { list-style: none; padding: 0; margin: 0; }
  .contact li {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    word-break: break-word;
  }
  .contact li img { width: 11px; height: 11px; flex-shrink: 0; }
  .lang-list li, .edu-list li { margin-bottom: 6px; }
  .muted { color: var(--soft); }
  .hobbies { margin: 0; }

  .main {
    padding: 14mm 16mm 14mm 8mm;
  }
  .name {
    font-size: 26pt;
    font-weight: 700;
    margin: 0;
    line-height: 1.05;
    color: var(--text-dark);
  }
  .subtitle {
    font-size: 11.5pt;
    font-weight: 600;
    color: var(--teal);
    margin: 4px 0 0;
  }
  .section-heading {
    font-size: 11pt;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--teal);
    margin: 20px 0 10px;
  }
  .profile-text { margin: 0; }
  /* Paragraph spacing — empty-line in the textarea becomes a real gap. */
  .profile-text + .profile-text { margin-top: 0.7em; }

  /* Skill matrix */
  .matrix table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 4px;
  }
  .matrix th {
    text-align: left;
    font-weight: 700;
    font-size: 8pt;
    color: #444;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 6px 8px 6px 0;
    border-bottom: 0.6pt solid #9ca3af;
  }
  .matrix td {
    padding: 7px 8px 7px 0;
    border-bottom: 0.3pt solid var(--divider);
    vertical-align: middle;
    font-size: 9.5pt;
  }
  .matrix td.skill { font-weight: 400; }
  .matrix td.skill.must { font-weight: 700; }
  .matrix td.lvl-label {
    font-size: 7.5pt;
    color: var(--soft);
    white-space: nowrap;
  }
  /* Visually mute rows where I haven't used the skill on any project yet. */
  .matrix tr.no-experience td.skill,
  .matrix tr.no-experience td.lvl-label,
  .matrix tr.no-experience td.used { color: #9ca3af; font-style: italic; }
  .matrix td.used { font-size: 8.5pt; color: var(--muted); }
  .matrix td.used a { color: inherit; }

  /* Level bar */
  .bar { display: inline-flex; gap: 2px; vertical-align: middle; }
  .dot {
    width: 5pt; height: 5pt;
    background: #d1d5db;
    border-radius: 1pt;
    display: inline-block;
  }
  .dot.on { background: var(--teal); }

  /* Project timeline */
  .timeline { padding: 0; }
  .project {
    display: grid;
    grid-template-columns: 62pt 1fr;
    column-gap: 14pt;
    break-inside: avoid;
    page-break-inside: avoid;
    padding: 0 0 14px;
    border-bottom: 0.5pt solid var(--divider);
    margin-bottom: 14px;
  }
  .project:last-child { border-bottom: none; }
  .date-rail {
    font-size: 8.5pt;
    font-weight: 600;
    color: var(--teal);
    text-align: right;
    padding-top: 2px;
  }
  .proj-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 8pt;
    margin: 0;
  }
  .proj-title {
    font-size: 12.5pt;
    font-weight: 700;
    margin: 0;
    color: var(--text-dark);
  }
  .proj-url {
    font-size: 8.5pt;
    color: var(--soft);
    flex-shrink: 0;
  }
  .proj-github {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 8.5pt;
    color: var(--soft);
    flex-shrink: 0;
  }
  .proj-github img {
    width: 10pt;
    height: 10pt;
  }
  .personal-badge {
    display: inline-block;
    margin-left: 8px;
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--teal-bg);
    color: var(--teal);
    font-size: 8pt;
    font-weight: 600;
    vertical-align: middle;
  }
  .proj-meta {
    font-size: 9pt;
    color: var(--muted);
    margin: 2px 0 0;
  }
  .proj-highlights {
    margin: 6px 0 0;
    padding-left: 16px;
    font-size: 9.5pt;
  }
  .proj-highlights li { margin-bottom: 3px; }
  .quote {
    margin: 10px 0 0;
    padding: 8px 12px 8px 24px;
    background: var(--teal-bg);
    border-radius: 4px;
    position: relative;
  }
  .quote::before {
    content: "“"; /* big curly open quote */
    position: absolute;
    top: 0;
    left: 6px;
    font-size: 22pt;
    line-height: 1;
    color: var(--teal);
    font-family: Georgia, "Times New Roman", serif;
  }
  .quote .q-text {
    margin: 0;
    font-style: italic;
    font-size: 9.5pt;
    color: #1f2937;
  }
  .quote .q-attrib {
    margin: 2px 0 0;
    text-align: right;
    font-size: 8.5pt;
    color: var(--soft);
  }
  .proj-skills {
    margin: 8px 0 0;
    font-size: 8.2pt;
    color: var(--soft);
  }
  .proj-skills .matched {
    color: var(--teal);
    font-weight: 600;
  }

  /* The page footer is supplied by Playwright's footerTemplate and renders
   * into the bottom @page margin. Page 1 has margin: 0 (see @page :first)
   * which leaves no space for the footer, so it's effectively hidden there. */
  .post-page-1 { display: contents; }
  `;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <title>${esc(profile.name)} – ${esc(title)}</title>
  <style>${css}</style>
</head>
<body>
  <section class="page-1">
    ${sidebarHtml}
    <main class="main">
      <h1 class="name">${esc(profile.name)}</h1>
      <p class="subtitle">${esc(title)}</p>
      <h2 class="section-heading">${esc(t.profile)}</h2>
      <p class="profile-text">${esc(summary).replace(/\n\n/g, '</p><p class="profile-text">')}</p>
      ${matrixHtml}
    </main>
  </section>

  <section class="post-page-1">
    <h2 class="section-heading">${esc(t.experience)}</h2>
    <div class="timeline">
      ${projectsHtml}
    </div>
  </section>
</body>
</html>`;
}
