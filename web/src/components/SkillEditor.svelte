<script lang="ts">
  import { api, type Skill } from "../lib/api";

  let {
    items = $bindable<Skill[]>([]),
    suggestions = [],
    highlights = [],
  }: {
    items: Skill[];
    suggestions?: string[];
    highlights?: string[];
  } = $props();

  let newSkill = $state("");
  let newLevel = $state<1 | 2 | 3 | 4>(3);
  let suggestingAi = $state(false);
  let aiSuggestions = $state<Skill[]>([]);
  let aiError = $state<string | null>(null);

  function add() {
    const name = newSkill.trim();
    if (!name) return;
    if (items.some((s) => s.skill.toLowerCase() === name.toLowerCase())) return;
    items = [...items, { skill: name, level: newLevel }];
    newSkill = "";
  }
  function remove(i: number) {
    items = items.filter((_, idx) => idx !== i);
  }
  function setLevel(i: number, lvl: number) {
    items = items.map((s, idx) =>
      idx === i
        ? { ...s, level: Math.max(1, Math.min(4, lvl)) as 1 | 2 | 3 | 4 }
        : s,
    );
  }
  function addSuggested(s: Skill) {
    if (items.some((x) => x.skill.toLowerCase() === s.skill.toLowerCase()))
      return;
    items = [...items, s];
    aiSuggestions = aiSuggestions.filter(
      (x) => x.skill.toLowerCase() !== s.skill.toLowerCase(),
    );
  }
  async function runSuggest() {
    if (highlights.length === 0) {
      aiError = "No highlights yet — add some first.";
      return;
    }
    suggestingAi = true;
    aiError = null;
    try {
      const r = await api.llm.suggestSkills(
        highlights,
        items.map((s) => s.skill),
      );
      aiSuggestions = r.skills;
      if (aiSuggestions.length === 0) aiError = "No new suggestions.";
    } catch (e) {
      aiError = String(e);
    } finally {
      suggestingAi = false;
    }
  }

  const labels = ["", "Familiar", "Proficient", "Advanced", "Expert"];

  // Drag-to-reorder
  let dragIdx = $state<number | null>(null);
  let overIdx = $state<number | null>(null);
  function onDragStart(i: number, e: DragEvent) {
    dragIdx = i;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(i));
    }
  }
  function onDragOver(i: number, e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    overIdx = i;
  }
  function onDrop(i: number, e: DragEvent) {
    e.preventDefault();
    const from = dragIdx;
    overIdx = null;
    dragIdx = null;
    if (from === null || from === i) return;
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(i, 0, moved!);
    items = next;
  }
  function onDragEnd() {
    dragIdx = null;
    overIdx = null;
  }
</script>

<div class="row" style="justify-content: space-between; align-items: center;">
  <span class="field-label" style="margin: 0;"
    >Skills (1=Familiar · 4=Expert)</span
  >
  <button
    type="button"
    onclick={runSuggest}
    disabled={suggestingAi}
    title="Suggest skills from highlights via Claude"
  >
    {#if suggestingAi}…{:else}✨ Suggest from highlights{/if}
  </button>
</div>

{#if aiError}
  <p class="muted" style="font-size:12px;color:#dc2626;">{aiError}</p>
{/if}

{#if aiSuggestions.length > 0}
  <div
    style="background:#f0fdfa;border-radius:4px;padding:6px 8px;margin:6px 0;"
  >
    <p class="muted" style="margin:0 0 4px;font-size:12px;">
      Suggestions (click to add):
    </p>
    {#each aiSuggestions as s (s.skill)}
      <button
        type="button"
        onclick={() => addSuggested(s)}
        style="margin:2px 3px 2px 0;font-size:12px;padding:2px 8px;"
        title="Add {s.skill} at level {s.level}"
      >
        + {s.skill} <span style="color:#0f766e;">L{s.level}</span>
      </button>
    {/each}
  </div>
{/if}

{#each items as s, i (s.skill)}
  <div
    class="skill-line"
    class:drag-over={overIdx === i && dragIdx !== i}
    class:dragging={dragIdx === i}
    draggable="true"
    ondragstart={(e) => onDragStart(i, e)}
    ondragover={(e) => onDragOver(i, e)}
    ondrop={(e) => onDrop(i, e)}
    ondragend={onDragEnd}
    role="listitem"
  >
    <span class="grip" title="Drag to reorder">⋮⋮</span>
    <span>{s.skill}</span>
    <span class="row" style="gap: 4px;">
      {#each [1, 2, 3, 4] as lvl}
        <button
          onclick={() => setLevel(i, lvl)}
          style="padding: 2px 8px; min-width: 28px; background: {lvl <= s.level
            ? '#1f2937'
            : 'white'}; color: {lvl <= s.level ? 'white' : '#374151'};"
          title={labels[lvl]}
        >
          {lvl}
        </button>
      {/each}
    </span>
    <button class="danger" onclick={() => remove(i)}>×</button>
  </div>
{/each}

<div class="row" style="margin-top: 8px;">
  <input
    type="text"
    placeholder="Add skill (e.g. TypeScript)"
    list="skill-suggestions"
    bind:value={newSkill}
    onkeydown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
  />
  <select bind:value={newLevel} style="width: auto;">
    <option value={1}>1 Familiar</option>
    <option value={2}>2 Proficient</option>
    <option value={3}>3 Advanced</option>
    <option value={4}>4 Expert</option>
  </select>
  <button onclick={add}>Add</button>
</div>
<datalist id="skill-suggestions">
  {#each suggestions as s}
    <option value={s}></option>
  {/each}
</datalist>

<style>
  .skill-line {
    display: grid;
    grid-template-columns: 18px 1fr auto auto;
    gap: 8px;
    align-items: center;
    padding: 2px 0;
    border-radius: 4px;
  }
  .skill-line.dragging {
    opacity: 0.4;
  }
  .skill-line.drag-over {
    background: #f0fdfa;
    box-shadow: inset 0 2px 0 #1a1a1a;
  }
  .grip {
    cursor: grab;
    color: #9ca3af;
    font-size: 14px;
    user-select: none;
    text-align: center;
  }
  .grip:active {
    cursor: grabbing;
  }
</style>
