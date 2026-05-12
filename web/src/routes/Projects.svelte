<script lang="ts">
  import { api, type Project } from "../lib/api";

  let { onEdit, onNew }: { onEdit: (id: string) => void; onNew: () => void } =
    $props();

  let projects = $state<Project[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  async function load() {
    loading = true;
    try {
      projects = await api.projects.list();
      error = null;
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }

  load();

  async function deleteOne(id: string) {
    if (!confirm(`Delete project "${id}"? This cannot be undone.`)) return;
    await api.projects.delete(id);
    await load();
  }

  function fmtPeriod(p: Project) {
    const end = p.end_ym === "present" ? "now" : p.end_ym;
    return `${p.start_ym} – ${end}`;
  }
</script>

<div class="row" style="justify-content: space-between; margin-bottom: 12px;">
  <h2 style="margin:0;">Projects</h2>
  <button class="primary" onclick={onNew}>+ New project</button>
</div>

{#if error}
  <div class="error">{error}</div>
{/if}

{#if loading}
  <p class="muted">Loading…</p>
{:else}
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Title (DE)</th>
        <th>Period</th>
        <th>Prio</th>
        <th>Skills</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each projects as p (p.id)}
        <tr>
          <td><code>{p.id}</code></td>
          <td>{p.title_de}</td>
          <td>{fmtPeriod(p)}</td>
          <td><span class="chip">{p.prio}</span></td>
          <td>{p.skills.length}</td>
          <td style="text-align:right;white-space:nowrap;">
            <button onclick={() => onEdit(p.id)}>Edit</button>
            <button class="danger" onclick={() => deleteOne(p.id)}
              >Delete</button
            >
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
