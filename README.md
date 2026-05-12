# magiCV

Local CV tailoring tool. Edit your projects in a SQLite-backed web UI, paste a job description, and get a tailored 3–5 page PDF (DE + EN) rendered from HTML via headless Chromium.

## Setup

```bash
bun install         # JS dependencies only
bun run setup       # downloads the Playwright Chromium build (~100 MB, one-time)
bun dev             # vite on :5174, bun server on :5173, open http://127.0.0.1:5174
```

`bun run setup` is a thin wrapper for `bunx playwright install chromium`. It's kept out of `postinstall` so `bun install` stays fast and predictable in CI and sandboxes; you only pay the Chromium download once, when you actually want to render PDFs.

First run starts with an empty DB. Open the UI and fill in your Profile + Projects; the data is persisted to `data/magicv.db` (gitignored).

## Build & run as a single process

```bash
bun run build
bun start        # bun serves the SPA + API on :5173
```

## Requirements

- Bun 1.3+
- Claude Code CLI (`claude`) on PATH — used for the JD-extraction and tailored-summary LLM calls.
- Playwright Chromium — install once with `bun run setup` (downloads ~100 MB into Playwright's cache).

### Optional

- **Ghostscript** (`gs` on PATH) — post-processes the generated PDF to shrink + linearize it (~700 KB → ~110 KB). The render pipeline detects `gs` automatically and skips the step if it's missing.
  - Install: `brew install ghostscript` (macOS) · `apt install ghostscript` (Debian/Ubuntu).
  - Tune output size via `MAGICV_PDF_PRESET` env var: `/screen` (smallest), `/ebook` (default), `/printer`, `/prepress`.

## How it works

```text
[Browser SPA]  ←HTTP→  [Bun server on 127.0.0.1:5173]
                              │
                              ├─ bun:sqlite       → data/magicv.db
                              ├─ child_process    → `claude -p --json-schema …`
                              └─ playwright       → renderHtml() → page.pdf()
```

- **Profile, projects, skills, quotes, runs** live in `data/magicv.db` (SQLite).
- **Tailored CV** flow: paste JD → `claude` extracts must-have / should-have skills + writes a tailored 1–3 sentence summary → server matches skills against your project history → renders an HTML document → headless Chromium produces the PDF.
- **Default CV** flow: skips the JD step, uses `summary_default_de/en` + `featured_skills` from your profile.
- **PDF features**: teal-accented sidebar (photo, contact icons, languages, education, hobbies), skill-match table on page 1 with internal anchor links to project blocks on subsequent pages, page numbers in bottom-right.

## Useful scripts

```bash
bun run check             # typecheck + lint + format-check + knip
bun run typecheck         # tsc --noEmit + svelte-check
bun run lint              # oxlint
bun run format            # prettier --write .
bun run build             # vite build → web/dist
bun run db:generate       # drizzle-kit: generate a migration from schema changes
bun run db:studio         # drizzle-kit: web UI for inspecting the DB
```

## Layout

```text
magicv/
├── server/
│   ├── index.ts             # thin Hono app: CORS + route mounts
│   ├── routes/              # one Hono sub-app per resource (profile, projects, llm, render, runs, …)
│   ├── db.ts                # drizzle-backed query functions
│   ├── db/
│   │   ├── schema.ts        # drizzle table definitions (source of truth)
│   │   └── connection.ts    # opens SQLite + runs drizzle migrations on boot
│   ├── schema.ts            # zod schemas for API request/response shapes
│   ├── extract.ts           # JD → must/should-have skills via `claude -p --json-schema`
│   ├── summary.ts           # tailored summary via `claude -p --json-schema`
│   ├── match.ts             # buildMatrix + pickProjectsForRender
│   └── render.ts            # renderHtml() + Playwright → PDF
├── drizzle/                 # generated SQL migrations (committed)
├── templates/
│   └── cv.html.ts           # HTML/CSS template (one module, both languages)
├── web/                     # Svelte 5 + Vite SPA
│   └── src/
│       ├── App.svelte       # hash-based router (tailor / projects / profile)
│       ├── routes/
│       └── components/
├── assets/
│   ├── profile_placeholder.svg
│   ├── icons/               # mail/phone/linkedin/github/map-pin (Tabler, tinted teal)
│   └── uploads/             # gitignored — user-uploaded profile photos
├── data/                    # gitignored — magicv.db (your source of truth)
└── out/                     # gitignored — generated PDFs
```

## Backing up your data

`data/magicv.db` is your source of truth. Copy it anywhere for a backup.

## License

MIT — see [LICENSE](LICENSE).
