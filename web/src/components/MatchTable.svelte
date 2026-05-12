<script lang="ts">
  import { api, type MatrixEntry, type Project } from "../lib/api";

  let {
    matrix = $bindable<MatrixEntry[]>([]),
    projects = $bindable<Project[]>([]),
    must_have = [],
    should_have = [],
  }: {
    matrix: MatrixEntry[];
    projects: Project[];
    must_have?: string[];
    should_have?: string[];
  } = $props();

  function toggleProject(i: number, pid: string) {
    const m = matrix[i]!;
    const ids = m.project_ids.includes(pid)
      ? m.project_ids.filter((x) => x !== pid)
      : [...m.project_ids, pid];
    matrix = matrix.map((entry, idx) =>
      idx === i ? { ...entry, project_ids: ids } : entry,
    );
  }

  // ---- Inline "Add missing skill to projects" picker ----
  let addingIdx = $state<number | null>(null);
  let addLevel = $state<1 | 2 | 3 | 4>(3);
  let addSelectedIds = $state<string[]>([]);
  let saving = $state(false);
  let err = $state<string | null>(null);

  function startAdd(i: number) {
    addingIdx = i;
    addLevel = 3;
    addSelectedIds = [];
    err = null;
  }
  function cancelAdd() {
    addingIdx = null;
    addSelectedIds = [];
    err = null;
  }
  function toggleSelect(pid: string) {
    addSelectedIds = addSelectedIds.includes(pid)
      ? addSelectedIds.filter((x) => x !== pid)
      : [...addSelectedIds, pid];
  }

  async function saveAdd() {
    if (addingIdx === null) return;
    const m = matrix[addingIdx]!;
    if (addSelectedIds.length === 0) {
      err = "Pick at least one project.";
      return;
    }
    saving = true;
    err = null;
    try {
      await api.bulkAddSkill(m.skill, addLevel, addSelectedIds);
      // Refresh project list so subsequent renders see the new skill.
      projects = await api.projects.list();
      // Rebuild the matrix locally (cheap, no LLM).
      const r = await api.rebuildMatrix(must_have, should_have);
      matrix = r.matrix;
      cancelAdd();
    } catch (e) {
      err = String(e);
    } finally {
      saving = false;
    }
  }
</script>

<div class="row" style="justify-content: space-between; margin-bottom: 6px;">
  <span class="muted" style="font-size: 12px;">
    Untick a row to keep it out of the rendered PDF.
  </span>
  <span class="row" style="gap: 6px;">
    <button
      type="button"
      onclick={() => (matrix = matrix.map((m) => ({ ...m, included: true })))}
      style="font-size: 11px; padding: 2px 8px;">Select all</button
    >
    <button
      type="button"
      onclick={() => (matrix = matrix.map((m) => ({ ...m, included: false })))}
      style="font-size: 11px; padding: 2px 8px;">Select none</button
    >
  </span>
</div>

<table>
  <thead>
    <tr>
      <th style="width: 24px;"></th>
      <th>Skill</th>
      <th>Kind</th>
      <th>Level</th>
      <th>Used in (click to toggle)</th>
    </tr>
  </thead>
  <tbody>
    {#each matrix as m, i (m.skill)}
      <tr
        class:no-experience={m.level === 0}
        class:excluded={m.included === false}
      >
        <td>
          <input
            type="checkbox"
            checked={m.included !== false}
            onchange={(e) => {
              const include = (e.currentTarget as HTMLInputElement).checked;
              matrix = matrix.map((entry, idx) =>
                idx === i ? { ...entry, included: include } : entry,
              );
            }}
            aria-label="Include {m.skill} in rendered PDF"
            title="Include this skill in the rendered PDF"
          />
        </td>
        <td><strong>{m.skill}</strong></td>
        <td>
          <span class="chip {m.kind}">{m.kind}</span>
        </td>
        <td>
          <span class="level-bar">
            {#each [1, 2, 3, 4] as lvl}
              <span class:on={lvl <= m.level}></span>
            {/each}
          </span>
        </td>
        <td>
          {#if m.level === 0}
            {#if addingIdx === i}
              <div class="add-pane">
                <div
                  class="row"
                  style="gap: 6px; align-items: center; margin-bottom: 6px;"
                >
                  <span class="muted" style="font-size: 12px;"
                    >Add "<strong>{m.skill}</strong>" at level:</span
                  >
                  <select bind:value={addLevel} style="width: auto;">
                    <option value={1}>1 Familiar</option>
                    <option value={2}>2 Proficient</option>
                    <option value={3}>3 Advanced</option>
                    <option value={4}>4 Expert</option>
                  </select>
                  <span class="muted" style="font-size: 12px;">to:</span>
                </div>
                <div class="proj-grid">
                  {#each projects as p}
                    <label
                      class="proj-chip"
                      class:on={addSelectedIds.includes(p.id)}
                    >
                      <input
                        type="checkbox"
                        checked={addSelectedIds.includes(p.id)}
                        onchange={() => toggleSelect(p.id)}
                      />
                      {p.id}
                    </label>
                  {/each}
                </div>
                {#if err}<p class="error" style="margin: 4px 0;">{err}</p>{/if}
                <div class="row" style="gap: 6px; margin-top: 6px;">
                  <button class="primary" onclick={saveAdd} disabled={saving}>
                    {saving ? "Saving…" : "Save & rebuild matrix"}
                  </button>
                  <button onclick={cancelAdd} disabled={saving}>Cancel</button>
                </div>
              </div>
            {:else}
              <span class="muted" style="font-style: italic;"
                >no project lists this skill</span
              >
              <button
                type="button"
                onclick={() => startAdd(i)}
                style="margin-left: 6px; padding: 2px 8px; font-size: 12px;"
                >+ Add to projects</button
              >
            {/if}
          {:else}
            {#each projects as p}
              {#if p.skills.some((s) => s.skill === m.skill)}
                <button
                  style="padding: 2px 8px; margin: 2px; background: {m.project_ids.includes(
                    p.id,
                  )
                    ? '#1f2937'
                    : 'white'}; color: {m.project_ids.includes(p.id)
                    ? 'white'
                    : '#374151'};"
                  onclick={() => toggleProject(i, p.id)}
                >
                  {p.id}
                </button>
              {/if}
            {/each}
          {/if}
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .no-experience td {
    color: #6b7280;
  }
  /* Excluded rows: dimmed so it's visually obvious they won't render. */
  tr.excluded td {
    opacity: 0.4;
  }
  tr.excluded td:first-child {
    opacity: 1;
  } /* keep checkbox crisp */
  .add-pane {
    background: #f0fdfa;
    border: 1px solid #99f6e4;
    border-radius: 4px;
    padding: 8px 10px;
    margin: 4px 0;
  }
  .proj-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .proj-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: white;
    font-size: 12px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }
  .proj-chip.on {
    background: #0f766e;
    color: white;
    border-color: #0f766e;
  }
  .proj-chip input {
    margin: 0;
  }
</style>
