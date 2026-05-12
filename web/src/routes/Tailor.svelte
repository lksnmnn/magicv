<script lang="ts">
  import {
    api,
    displayFilename,
    downloadUrl,
    type MatrixEntry,
    type Profile,
    type Project,
    type Run,
    type TailorResponse,
  } from "../lib/api";
  import { autoresize } from "../lib/autoresize";
  import MatchTable from "../components/MatchTable.svelte";

  let jdText = $state("");
  let lang = $state<"de" | "en">("de");
  let extracting = $state(false);
  let rendering = $state(false);
  let renderingDefault = $state(false);
  let error = $state<string | null>(null);
  let result = $state<TailorResponse | null>(null);
  let projects = $state<Project[]>([]);
  let profile = $state<Profile | null>(null);
  let runs = $state<Run[]>([]);

  // Editable copies
  let editableSummary = $state("");
  let editableRoleTitle = $state("");
  let editableMatrix = $state<MatrixEntry[]>([]);
  let editableProjectIds = $state<string[]>([]);

  async function loadProjects() {
    projects = await api.projects.list();
  }
  async function loadProfile() {
    profile = await api.profile.get();
  }
  async function loadRuns() {
    try {
      runs = await api.runs();
    } catch {
      runs = [];
    }
  }
  loadProjects();
  loadProfile();
  loadRuns();

  async function extract() {
    if (jdText.trim().length < 20) {
      error = "Paste a longer job description first.";
      return;
    }
    extracting = true;
    error = null;
    try {
      const r = await api.tailor(jdText, lang);
      result = r;
      editableSummary = r.summary;
      editableRoleTitle = r.role_title;
      editableMatrix = r.matrix.map((m) => ({
        ...m,
        project_ids: [...m.project_ids],
      }));
      editableProjectIds = [...r.project_ids];
    } catch (e) {
      error = String(e);
    } finally {
      extracting = false;
    }
  }

  // Rendered PDFs are kept as blob URLs and shown in a preview pane
  // instead of triggering a browser download. The user clicks "Download"
  // when they actually want the file on disk.
  type RenderedPdf = { url: string; filename: string };
  let renderedDe = $state<RenderedPdf | null>(null);
  let renderedEn = $state<RenderedPdf | null>(null);
  let activePreview = $state<"de" | "en">("de");

  function clearRendered() {
    if (renderedDe) URL.revokeObjectURL(renderedDe.url);
    if (renderedEn) URL.revokeObjectURL(renderedEn.url);
    renderedDe = null;
    renderedEn = null;
  }

  /** Render a single language and stash the blob URL for preview. */
  async function renderOne(payload: {
    lang: "de" | "en";
    role_title: string;
    summary: string;
    matrix: MatrixEntry[];
    project_ids: string[];
    jd_text: string;
    group_id?: string;
  }): Promise<RenderedPdf> {
    const blob = await api.render(payload);
    const url = URL.createObjectURL(blob);
    const filename = displayFilename(
      profile?.name ?? "CV",
      payload.lang,
      payload.role_title,
    );
    return { url, filename };
  }

  /** Render both DE and EN; show in the preview pane (no auto-download). */
  async function renderBoth() {
    if (!result) return;
    rendering = true;
    error = null;
    try {
      clearRendered();
      // Send the full matrix incl. `included` flags so the server can persist
      // it on the run record. The server filters before rendering.
      const groupId = crypto.randomUUID();
      const common = {
        role_title: editableRoleTitle,
        summary: editableSummary,
        matrix: editableMatrix,
        project_ids: editableProjectIds,
        jd_text: jdText,
        group_id: groupId,
      };
      renderedDe = await renderOne({ lang: "de", ...common });
      renderedEn = await renderOne({ lang: "en", ...common });
      activePreview = "de";
      await loadRuns();
    } catch (e) {
      error = String(e);
    } finally {
      rendering = false;
    }
  }

  /**
   * Generic CV: no JD, default summary, all projects.
   * Builds a "core skills" matrix from `profile.featured_skills` if present.
   */
  function buildFeaturedMatrix(): MatrixEntry[] {
    if (!profile || profile.featured_skills.length === 0) return [];
    const prioOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

    const byId = new Map(projects.map((p) => [p.id, p]));
    const skillToProjects = new Map<string, string[]>();
    for (const p of projects) {
      for (const s of p.skills) {
        const list = skillToProjects.get(s.skill) ?? [];
        list.push(p.id);
        skillToProjects.set(s.skill, list);
      }
    }

    const sortByPrioDate = (a: string, b: string) => {
      const pa = byId.get(a)!;
      const pb = byId.get(b)!;
      const dp = (prioOrder[pa.prio] ?? 99) - (prioOrder[pb.prio] ?? 99);
      if (dp !== 0) return dp;
      return pb.end_ym.localeCompare(pa.end_ym);
    };

    return profile.featured_skills.map((name) => {
      const allLevels = projects.flatMap((p) =>
        p.skills.filter((s) => s.skill === name).map((s) => s.level),
      );
      const level = allLevels.length ? Math.max(...allLevels) : 0;
      const all = (skillToProjects.get(name) ?? []).toSorted(sortByPrioDate);
      const nonLow = all.filter((id) => byId.get(id)!.prio !== "low");
      const projIds = nonLow.length > 0 ? nonLow : all;
      return {
        skill: name,
        level,
        kind: "should" as const,
        project_ids: projIds,
      };
    });
  }

  async function renderDefault() {
    if (!profile) return;
    renderingDefault = true;
    error = null;
    try {
      clearRendered();
      const allIds = projects.map((p) => p.id);
      const matrix = buildFeaturedMatrix();
      const groupId = crypto.randomUUID();
      renderedDe = await renderOne({
        lang: "de",
        role_title: "Lebenslauf",
        summary: profile.summary_default_de,
        matrix,
        project_ids: allIds,
        jd_text: "",
        group_id: groupId,
      });
      renderedEn = await renderOne({
        lang: "en",
        role_title: "CV",
        summary: profile.summary_default_en,
        matrix,
        project_ids: allIds,
        jd_text: "",
        group_id: groupId,
      });
      activePreview = "de";
      await loadRuns();
    } catch (e) {
      error = String(e);
    } finally {
      renderingDefault = false;
    }
  }

  function downloadActive() {
    const r = activePreview === "de" ? renderedDe : renderedEn;
    if (!r) return;
    downloadUrl(r.url, r.filename);
  }

  let regenSummary = $state(false);
  async function regenerateSummary() {
    if (!result) return;
    regenSummary = true;
    error = null;
    try {
      const r = await api.llm.summary({
        lang,
        role_title: editableRoleTitle,
        summary_hint: result.summary_hint,
        matrix: editableMatrix.filter((m) => m.included !== false),
      });
      editableSummary = r.summary;
    } catch (e) {
      error = String(e);
    } finally {
      regenSummary = false;
    }
  }

  function toggleProjectInRender(id: string) {
    editableProjectIds = editableProjectIds.includes(id)
      ? editableProjectIds.filter((x) => x !== id)
      : [...editableProjectIds, id];
  }

  let reopening = $state<number | null>(null);
  async function reopenRun(id: number) {
    reopening = id;
    error = null;
    try {
      const r = await api.runFull(id);
      jdText = r.jd_text;
      lang = r.lang;
      editableRoleTitle = r.role_title;
      editableSummary = r.summary;
      editableMatrix = r.matrix.map((m) => ({
        ...m,
        project_ids: [...m.project_ids],
      }));
      editableProjectIds = [...r.project_ids];
      // Synthetic result so the editor UI is shown. must_have/should_have
      // partition is reconstructed from the stored matrix.
      result = {
        role_title: r.role_title,
        summary_hint: "",
        must_have: r.matrix
          .filter((m) => m.kind === "must")
          .map((m) => m.skill),
        should_have: r.matrix
          .filter((m) => m.kind === "should")
          .map((m) => m.skill),
        matrix: r.matrix,
        project_ids: r.project_ids,
        summary: r.summary,
      };
      clearRendered();
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      error = String(e);
    } finally {
      reopening = null;
    }
  }

  async function clearAllRuns() {
    if (!confirm("Delete ALL runs and their PDF files? Cannot be undone."))
      return;
    try {
      await api.deleteAllRuns();
      await loadRuns();
    } catch (e) {
      error = String(e);
    }
  }

  let previewUrl = $state<string | null>(null);
  let previewLang = $state<"de" | "en">("de");
  let previewing = $state(false);

  async function refreshPreview(targetLang: "de" | "en") {
    if (!result) return;
    previewing = true;
    error = null;
    try {
      // Revoke the old blob URL to release memory.
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = await api.previewUrl({
        lang: targetLang,
        role_title: editableRoleTitle,
        summary: editableSummary,
        matrix: editableMatrix,
        project_ids: editableProjectIds,
        jd_text: jdText,
      });
      previewLang = targetLang;
    } catch (e) {
      error = String(e);
    } finally {
      previewing = false;
    }
  }

  // Group DE+EN runs that share a run_group_id into a single row. Old rows
  // (pre-grouping) have empty group_id and were paired by the server-side
  // backfill; anything still ungrouped renders as its own one-language row.
  type RunGroup = {
    key: string;
    created_at: string;
    role_title: string;
    de: Run | null;
    en: Run | null;
  };
  const groupedRuns = $derived.by<RunGroup[]>(() => {
    const byKey = new Map<string, RunGroup>();
    const order: string[] = [];
    for (const r of runs) {
      const key = r.run_group_id || `solo-${r.id}`;
      let g = byKey.get(key);
      if (!g) {
        g = {
          key,
          created_at: r.created_at,
          role_title: r.role_title,
          de: null,
          en: null,
        };
        byKey.set(key, g);
        order.push(key);
      }
      if (r.lang === "de") g.de = r;
      else g.en = r;
      // Latest created_at wins for the group label.
      if (r.created_at > g.created_at) g.created_at = r.created_at;
    }
    return order.map((k) => byKey.get(k)!);
  });

  async function deleteGroup(g: RunGroup) {
    const ids = [g.de?.id, g.en?.id].filter(
      (x): x is number => typeof x === "number",
    );
    if (ids.length === 0) return;
    const msg =
      ids.length === 2
        ? "Delete this run (both DE and EN PDFs)?"
        : "Delete this run (and its PDF file)?";
    if (!confirm(msg)) return;
    try {
      await Promise.all(ids.map((id) => api.deleteRun(id)));
      await loadRuns();
    } catch (e) {
      error = String(e);
    }
  }

  function fmtTime(s: string): string {
    try {
      const d = new Date(s.replace(" ", "T") + "Z");
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return s;
    }
  }
</script>

<h2 style="margin-top:0;">Tailor a CV</h2>

<div
  class="card"
  style="display: flex; justify-content: space-between; align-items: center;"
>
  <div>
    <h3 style="margin: 0 0 4px;">Default CV (no tailoring)</h3>
    <p class="muted" style="margin: 0;">
      Generates both DE and EN using your default summary, all projects, no
      skill-match table.
    </p>
  </div>
  <button
    class="primary"
    onclick={renderDefault}
    disabled={renderingDefault || !profile}
  >
    {#if renderingDefault}<span class="spinner"></span> Rendering…{:else}Render
      default (DE + EN){/if}
  </button>
</div>

<div class="card">
  <label>
    <span class="label-text">Job description</span>
    <textarea
      rows="10"
      bind:value={jdText}
      use:autoresize={jdText}
      placeholder="Paste the full job posting here…"
    ></textarea>
  </label>
  <div class="row" style="margin-top: 10px; justify-content: space-between;">
    <div class="row">
      <label style="margin: 0;">
        <span class="label-text">Language</span>
        <select bind:value={lang} style="width: auto;">
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </select>
      </label>
    </div>
    <button class="primary" onclick={extract} disabled={extracting}>
      {#if extracting}<span class="spinner"></span> Extracting (Claude)…{:else}Extract
        skills & summary{/if}
    </button>
  </div>
</div>

{#if error}
  <div class="error">{error}</div>
{/if}

{#if result}
  <div class="card">
    <label>
      <span class="label-text">Role title</span>
      <input bind:value={editableRoleTitle} />
    </label>
  </div>

  <div class="card">
    <div
      class="row"
      style="justify-content: space-between; align-items: center;"
    >
      <span class="field-label" style="margin: 0;">Tailored summary</span>
      <button
        type="button"
        onclick={regenerateSummary}
        disabled={regenSummary}
        title="Ask Claude for a fresh take, honoring the current skill match"
      >
        {#if regenSummary}<span class="spinner"></span> Regenerating…{:else}✨
          Regenerate{/if}
      </button>
    </div>
    <textarea
      rows="8"
      bind:value={editableSummary}
      use:autoresize={editableSummary}
    ></textarea>
  </div>

  <div class="card">
    <h3 style="margin-top:0;">Skill match</h3>
    <MatchTable
      bind:matrix={editableMatrix}
      bind:projects
      must_have={result.must_have}
      should_have={result.should_have}
    />
  </div>

  <div class="card">
    <h3 style="margin-top:0;">Projects to include</h3>
    <p class="muted">
      Click to toggle inclusion (high-priority projects pre-selected).
    </p>
    {#each projects as p (p.id)}
      <button
        style="margin: 3px; background: {editableProjectIds.includes(p.id)
          ? '#1f2937'
          : 'white'}; color: {editableProjectIds.includes(p.id)
          ? 'white'
          : '#374151'};"
        onclick={() => toggleProjectInRender(p.id)}
      >
        {p.id}
        <span class="muted" style="color: inherit; opacity: 0.7;"
          >({p.prio})</span
        >
      </button>
    {/each}
  </div>

  <div class="row" style="gap: 8px;">
    <button onclick={() => refreshPreview("de")} disabled={previewing}>
      {#if previewing && previewLang === "de"}…{:else}Preview DE{/if}
    </button>
    <button onclick={() => refreshPreview("en")} disabled={previewing}>
      {#if previewing && previewLang === "en"}…{:else}Preview EN{/if}
    </button>
    <button class="primary" onclick={renderBoth} disabled={rendering}>
      {#if rendering}<span class="spinner"></span> Rendering…{:else}Render
        tailored (DE + EN){/if}
    </button>
  </div>

  {#if renderedDe || renderedEn}
    {@const active = activePreview === "de" ? renderedDe : renderedEn}
    <div class="card" style="margin-top: 12px; padding: 0; overflow: hidden;">
      <div
        class="row"
        style="justify-content: space-between; padding: 8px 12px; background: #f9fafb; border-bottom: 1px solid var(--border); gap: 8px;"
      >
        <div class="row" style="gap: 4px;">
          <button
            class:primary={activePreview === "de"}
            onclick={() => (activePreview = "de")}
            disabled={!renderedDe}>DE</button
          >
          <button
            class:primary={activePreview === "en"}
            onclick={() => (activePreview = "en")}
            disabled={!renderedEn}>EN</button
          >
          <span class="muted" style="font-size: 12px; margin-left: 8px;">
            {active?.filename ?? ""}
          </span>
        </div>
        <div class="row" style="gap: 4px;">
          <button onclick={downloadActive} disabled={!active}>↓ Download</button
          >
          <button onclick={clearRendered}>Close</button>
        </div>
      </div>
      {#if active}
        <iframe
          src={active.url}
          title="Rendered CV"
          style="width: 100%; height: 1200px; border: 0; background: white;"
        ></iframe>
      {/if}
    </div>
  {/if}

  {#if previewUrl && !renderedDe && !renderedEn}
    <div class="card" style="margin-top: 12px; padding: 0; overflow: hidden;">
      <div
        class="row"
        style="justify-content: space-between; padding: 8px 12px; background: #f9fafb; border-bottom: 1px solid var(--border);"
      >
        <span class="muted" style="font-size:12px;"
          >Live HTML preview · {previewLang.toUpperCase()}</span
        >
        <button
          onclick={() => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = null;
          }}>Close</button
        >
      </div>
      <iframe
        src={previewUrl}
        title="CV HTML preview"
        style="width: 100%; height: 1200px; border: 0; background: white;"
      ></iframe>
    </div>
  {/if}
{/if}

{#if runs.length > 0}
  <div class="card" style="margin-top: 24px;">
    <div
      class="row"
      style="justify-content: space-between; margin-bottom: 8px;"
    >
      <h3 style="margin:0;">Recent runs</h3>
      <button class="danger" onclick={clearAllRuns}>Clear all</button>
    </div>
    <table>
      <thead>
        <tr><th></th><th>When</th><th>Role</th><th>Files</th><th></th></tr>
      </thead>
      <tbody>
        {#each groupedRuns as g (g.key)}
          {@const primary = g.de ?? g.en!}
          {@const reopenId = primary.id}
          <tr>
            <td>
              {#if primary.thumb_path}
                <a
                  href={`/api/runs/${primary.id}/pdf`}
                  target="_blank"
                  rel="noopener"
                >
                  <img
                    src={`/api/runs/${primary.id}/thumb`}
                    alt=""
                    style="width: 48px; height: 68px; object-fit: cover; border: 1px solid var(--border); border-radius: 3px; display: block;"
                  />
                </a>
              {/if}
            </td>
            <td style="white-space: nowrap;">{fmtTime(g.created_at)}</td>
            <td><strong>{g.role_title || "(no title)"}</strong></td>
            <td
              style="font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;"
            >
              {#each ["de", "en"] as const as l}
                {@const r = l === "de" ? g.de : g.en}
                {#if r}
                  <div>
                    <strong
                      style="font-family: inherit; text-transform: uppercase;"
                      >{l}</strong
                    >
                    ·
                    <a
                      href={`/api/runs/${r.id}/pdf`}
                      target="_blank"
                      rel="noopener"
                      download={displayFilename(
                        profile?.name ?? "CV",
                        r.lang,
                        r.role_title,
                      )}>PDF</a
                    >
                    {#if r.html_path}
                      · <a
                        href={`/api/runs/${r.id}/html`}
                        target="_blank"
                        rel="noopener">HTML</a
                      >
                    {/if}
                  </div>
                {/if}
              {/each}
            </td>
            <td style="text-align: right; white-space: nowrap;">
              <button
                onclick={() => reopenRun(reopenId)}
                disabled={reopening === reopenId}
                title="Load this run back into the editor"
                >{reopening === reopenId ? "…" : "Reopen"}</button
              >
              <button
                class="danger"
                onclick={() => deleteGroup(g)}
                title="Delete this run">×</button
              >
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
