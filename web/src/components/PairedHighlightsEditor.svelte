<script lang="ts">
  import { api, type HighlightPair } from "../lib/api";
  import { autoresize } from "../lib/autoresize";
  import FieldError from "./FieldError.svelte";

  let {
    items = $bindable<HighlightPair[]>([]),
    errorPrefix = "",
    errors = {},
  }: {
    items: HighlightPair[];
    /** Path prefix for FieldError lookup, e.g. "highlights" so each row
     *  resolves to "highlights.0.de" / "highlights.0.en". */
    errorPrefix?: string;
    errors?: Record<string, string>;
  } = $props();

  function add() {
    items = [...items, { de: "", en: "" }];
  }
  function remove(i: number) {
    items = items.filter((_, idx) => idx !== i);
  }
  function setDe(i: number, v: string) {
    items = items.map((h, idx) => (idx === i ? { ...h, de: v } : h));
  }
  function setEn(i: number, v: string) {
    items = items.map((h, idx) => (idx === i ? { ...h, en: v } : h));
  }

  // ---- Translate ----
  let translating = $state<number | null>(null);
  async function translate(i: number, direction: "de->en" | "en->de") {
    const p = items[i];
    if (!p) return;
    const [from, to] = direction.split("->") as ["de" | "en", "de" | "en"];
    const src = from === "de" ? p.de : p.en;
    if (!src.trim()) return;
    translating = i;
    try {
      const r = await api.llm.translate(src, from, to);
      if (to === "de") setDe(i, r.text);
      else setEn(i, r.text);
    } catch (e) {
      alert(String(e));
    } finally {
      translating = null;
    }
  }

  // ---- AI polish per bullet (per language) ----
  let polishIdx = $state<number | null>(null);
  let polishLang = $state<"de" | "en">("de");
  let polishProposal = $state("");
  let polishError = $state<string | null>(null);
  async function polish(i: number, lang: "de" | "en") {
    const p = items[i];
    if (!p) return;
    const text = (lang === "de" ? p.de : p.en).trim();
    if (!text) return;
    polishIdx = i;
    polishLang = lang;
    polishProposal = "";
    polishError = null;
    try {
      const ctx = items
        .filter((_, idx) => idx !== i)
        .map((h) => (lang === "de" ? h.de : h.en))
        .filter(Boolean)
        .join("\n");
      const r = await api.llm.polishHighlight(text, lang, ctx);
      polishProposal = r.text;
    } catch (e) {
      polishError = String(e);
    }
  }
  function acceptPolish() {
    if (polishIdx === null) return;
    if (polishLang === "de") setDe(polishIdx, polishProposal);
    else setEn(polishIdx, polishProposal);
    cancelPolish();
  }
  function cancelPolish() {
    polishIdx = null;
    polishProposal = "";
    polishError = null;
  }

  // ---- Drag-to-reorder ----
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

<div class="field-label">Highlights (paired DE / EN)</div>
{#each items as h, i (i)}
  <div
    class="row-wrap"
    class:drag-over={overIdx === i && dragIdx !== i}
    class:dragging={dragIdx === i}
  >
    <div
      class="ph-row"
      role="listitem"
      draggable="true"
      ondragstart={(e) => onDragStart(i, e)}
      ondragover={(e) => onDragOver(i, e)}
      ondrop={(e) => onDrop(i, e)}
      ondragend={onDragEnd}
    >
      <span class="grip" title="Drag to reorder">⋮⋮</span>
      <div class="cell">
        <textarea
          rows="4"
          value={h.de}
          use:autoresize={h.de}
          oninput={(e) =>
            setDe(i, (e.currentTarget as HTMLTextAreaElement).value)}
          placeholder="DE"
        ></textarea>
        <FieldError path={`${errorPrefix}.${i}.de`} {errors} />
        <div class="cell-actions">
          <button
            type="button"
            onclick={() => polish(i, "de")}
            disabled={polishIdx !== null}
            title="Polish DE">✨</button
          >
          <button
            type="button"
            class="trans"
            onclick={() => translate(i, "de->en")}
            disabled={translating !== null || !h.de.trim()}
            title="DE → EN">→</button
          >
        </div>
      </div>
      <div class="cell">
        <textarea
          rows="4"
          value={h.en}
          use:autoresize={h.en}
          oninput={(e) =>
            setEn(i, (e.currentTarget as HTMLTextAreaElement).value)}
          placeholder="EN"
        ></textarea>
        <FieldError path={`${errorPrefix}.${i}.en`} {errors} />
        <div class="cell-actions">
          <button
            type="button"
            class="trans"
            onclick={() => translate(i, "en->de")}
            disabled={translating !== null || !h.en.trim()}
            title="EN → DE">←</button
          >
          <button
            type="button"
            onclick={() => polish(i, "en")}
            disabled={polishIdx !== null}
            title="Polish EN">✨</button
          >
        </div>
      </div>
      <button class="danger" onclick={() => remove(i)} title="Delete">×</button>
    </div>

    {#if polishIdx === i}
      <div class="polish-pane">
        {#if polishError}
          <p class="error">{polishError}</p>
        {/if}
        {#if polishProposal}
          <p class="muted" style="margin:0 0 4px;">
            Proposed rewrite ({polishLang.toUpperCase()}):
          </p>
          <p
            style="background:#f0fdfa;padding:6px 8px;border-radius:4px;margin:0 0 6px;"
          >
            {polishProposal}
          </p>
          <div class="row" style="gap:6px;">
            <button class="primary" type="button" onclick={acceptPolish}
              >Accept</button
            >
            <button type="button" onclick={cancelPolish}>Discard</button>
          </div>
        {:else if !polishError}
          <p class="muted" style="margin:0;">Polishing…</p>
        {/if}
      </div>
    {/if}
  </div>
{/each}
<button onclick={add}>+ Add highlight</button>

<style>
  .row-wrap {
    margin-bottom: 6px;
    padding: 2px;
    border-radius: 4px;
  }
  .row-wrap.dragging {
    opacity: 0.4;
  }
  .row-wrap.drag-over {
    background: #f0fdfa;
    box-shadow: inset 0 2px 0 #1a1a1a;
  }
  .ph-row {
    display: grid;
    grid-template-columns: 16px 1fr 1fr auto;
    gap: 6px;
    align-items: flex-start;
  }
  .cell {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px;
    align-items: flex-start;
  }
  .cell textarea {
    width: 100%;
  }
  .cell-actions {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cell-actions button {
    padding: 2px 6px;
    font-size: 12px;
    min-width: 28px;
    line-height: 1;
  }
  .grip {
    cursor: grab;
    color: #9ca3af;
    font-size: 14px;
    user-select: none;
    text-align: center;
    padding-top: 6px;
  }
  .grip:active {
    cursor: grabbing;
  }
  .polish-pane {
    background: #fafafa;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 8px;
    margin: 4px 0 8px 24px;
  }
</style>
