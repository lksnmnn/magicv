<script lang="ts">
  import {
    api,
    ApiError,
    blankProject,
    fieldErrorMap,
    type Project,
  } from "../lib/api";
  import PairedHighlightsEditor from "../components/PairedHighlightsEditor.svelte";
  import SkillEditor from "../components/SkillEditor.svelte";
  import QuotesEditor from "../components/QuotesEditor.svelte";
  import LocalizedField from "../components/LocalizedField.svelte";
  import FieldError from "../components/FieldError.svelte";

  let { id, onBack }: { id: string | null; onBack: () => void } = $props();

  let project = $state<Project | null>(null);
  let originalId = $state<string>("");
  let loading = $state(true);
  let error = $state<string | null>(null);
  let fieldErrors = $state<Record<string, string>>({});
  let saving = $state(false);
  let suggestions = $state<string[]>([]);
  const isNew = $derived(id === null);

  async function load() {
    loading = true;
    try {
      const skills = await api.skills();
      suggestions = skills.map((s) => s.skill);
      project = id ? await api.projects.get(id) : blankProject();
      originalId = project.id;
      error = null;
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }
  load();

  async function save() {
    if (!project) return;
    saving = true;
    error = null;
    fieldErrors = {};
    try {
      if (isNew) {
        await api.projects.create(project);
      } else {
        if (project.id !== originalId) {
          await api.projects.rename(originalId, project.id);
        }
        await api.projects.update(project.id, project);
      }
      onBack();
    } catch (e) {
      if (e instanceof ApiError && e.issues.length > 0) {
        fieldErrors = fieldErrorMap(e);
        error = "Some fields need fixing.";
      } else {
        error = String(e);
      }
    } finally {
      saving = false;
    }
  }
</script>

<div class="row" style="margin-bottom: 12px; justify-content: space-between;">
  <button onclick={onBack}>← Back</button>
  <h2 style="margin:0;">{isNew ? "New project" : id}</h2>
  <button class="primary" onclick={save} disabled={saving}>
    {saving ? "Saving…" : "Save"}
  </button>
</div>

{#if error}
  <div class="error">{error}</div>
{/if}

{#if loading || !project}
  <p class="muted">Loading…</p>
{:else}
  <div class="card">
    <div class="grid-2">
      <div>
        <label>
          <span class="label-text">ID (slug)</span>
          <input
            bind:value={project.id}
            placeholder="e.g. acme-corp"
            pattern="[a-z0-9][a-z0-9-]*"
          />
        </label>
        <FieldError path="id" errors={fieldErrors} />
        {#if !isNew && project.id !== originalId}
          <p class="muted" style="margin: 4px 0 0; color: #b45309;">
            Renaming from <code>{originalId}</code> → <code>{project.id}</code>.
            All related rows (skills, highlights, quotes) will be updated.
          </p>
        {/if}
      </div>
      <div>
        <label>
          <span class="label-text">URL</span>
          <input bind:value={project.url} placeholder="https://…" />
        </label>
        <FieldError path="url" errors={fieldErrors} />
      </div>
      <div>
        <label>
          <span class="label-text">Contracted via (optional)</span>
          <input bind:value={project.via} placeholder="e.g. OSK GmbH" />
        </label>
        <FieldError path="via" errors={fieldErrors} />
      </div>
      <div>
        <label>
          <span class="label-text">Start (YYYY-MM)</span>
          <input bind:value={project.start_ym} placeholder="2024-01" />
        </label>
        <FieldError path="start_ym" errors={fieldErrors} />
      </div>
      <div>
        <label>
          <span class="label-text">End (YYYY-MM or "present")</span>
          <input bind:value={project.end_ym} placeholder="present" />
        </label>
        <FieldError path="end_ym" errors={fieldErrors} />
      </div>
      <div>
        <label>
          <span class="label-text">Team size (optional)</span>
          <input
            type="number"
            value={project.team_size ?? ""}
            oninput={(e) => {
              const v = (e.currentTarget as HTMLInputElement).value;
              if (project) project.team_size = v === "" ? null : Number(v);
            }}
          />
        </label>
        <FieldError path="team_size" errors={fieldErrors} />
      </div>
      <div>
        <label>
          <span class="label-text">Priority</span>
          <select bind:value={project.prio}>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
        </label>
        <FieldError path="prio" errors={fieldErrors} />
      </div>
      <div>
        <label
          style="display: flex; align-items: center; gap: 6px; padding-top: 22px;"
        >
          <input type="checkbox" bind:checked={project.is_personal} />
          Personal project
        </label>
      </div>
      {#if project.is_personal}
        <div>
          <label>
            <span class="label-text">GitHub URL</span>
            <input
              bind:value={project.github_url}
              placeholder="https://github.com/user/repo"
            />
          </label>
          <FieldError path="github_url" errors={fieldErrors} />
        </div>
      {/if}
    </div>

    <!-- Localised fields side-by-side with ↔ translate buttons -->
    <div style="margin-top: 8px;">
      <LocalizedField
        label="Role"
        bind:de={project.role_de}
        bind:en={project.role_en}
        context={`Project: ${project.title_de || project.title_en}`}
        onDeChange={(v) => (project!.role_de = v)}
        onEnChange={(v) => (project!.role_en = v)}
        deErrorPath="role_de"
        enErrorPath="role_en"
        errors={fieldErrors}
      />
      <LocalizedField
        label="Project title"
        bind:de={project.title_de}
        bind:en={project.title_en}
        context={project.role_de}
        onDeChange={(v) => (project!.title_de = v)}
        onEnChange={(v) => (project!.title_en = v)}
        deErrorPath="title_de"
        enErrorPath="title_en"
        errors={fieldErrors}
      />
      <LocalizedField
        label="Industry"
        bind:de={project.industry_de}
        bind:en={project.industry_en}
        onDeChange={(v) => (project!.industry_de = v)}
        onEnChange={(v) => (project!.industry_en = v)}
        deErrorPath="industry_de"
        enErrorPath="industry_en"
        errors={fieldErrors}
      />
    </div>
  </div>

  <div class="card">
    <PairedHighlightsEditor
      bind:items={project.highlights}
      errorPrefix="highlights"
      errors={fieldErrors}
    />
  </div>
  <div class="card">
    <SkillEditor
      bind:items={project.skills}
      {suggestions}
      highlights={project.highlights.flatMap((h) =>
        [h.de, h.en].filter(Boolean),
      )}
    />
  </div>
  <div class="card">
    <QuotesEditor bind:items={project.quotes} />
  </div>
{/if}
