<script lang="ts">
  import { api } from "../lib/api";
  import { autoresize } from "../lib/autoresize";
  import FieldError from "./FieldError.svelte";

  type Props = {
    label: string;
    de: string;
    en: string;
    /** Render as <textarea> instead of <input>. */
    multiline?: boolean;
    rows?: number;
    /** Free-form context string passed to the translation prompt
     * (e.g. surrounding project metadata) for terminology consistency. */
    context?: string;
    /** v-model style two-way bindings. */
    onDeChange: (v: string) => void;
    onEnChange: (v: string) => void;
    /** Optional: zod-error paths for each half + the parent's errors map. */
    deErrorPath?: string;
    enErrorPath?: string;
    errors?: Record<string, string>;
  };

  let {
    label,
    de = $bindable(),
    en = $bindable(),
    multiline = false,
    rows = 2,
    context,
    onDeChange,
    onEnChange,
    deErrorPath,
    enErrorPath,
    errors = {},
  }: Props = $props();

  let translating = $state<"de->en" | "en->de" | null>(null);
  let err = $state<string | null>(null);

  async function translate(direction: "de->en" | "en->de") {
    translating = direction;
    err = null;
    try {
      const [from, to] = direction.split("->") as ["de" | "en", "de" | "en"];
      const source = from === "de" ? de : en;
      if (!source.trim()) return;
      const r = await api.llm.translate(source, from, to, context);
      if (to === "en") {
        en = r.text;
        onEnChange(r.text);
      } else {
        de = r.text;
        onDeChange(r.text);
      }
    } catch (e) {
      err = String(e);
    } finally {
      translating = null;
    }
  }
</script>

<div class="loc-field">
  <div class="loc-row">
    <div class="loc-col">
      <label>
        <span class="label-text">{label} (DE)</span>
        {#if multiline}
          <textarea
            {rows}
            bind:value={de}
            use:autoresize={de}
            oninput={() => onDeChange(de)}
          ></textarea>
        {:else}
          <input bind:value={de} oninput={() => onDeChange(de)} />
        {/if}
      </label>
      {#if deErrorPath}
        <FieldError path={deErrorPath} {errors} />
      {/if}
    </div>
    <div class="loc-controls">
      <button
        class="trans"
        onclick={() => translate("de->en")}
        disabled={translating !== null || !de.trim()}
        title="Translate DE → EN"
      >
        {#if translating === "de->en"}…{:else}→{/if}
      </button>
      <button
        class="trans"
        onclick={() => translate("en->de")}
        disabled={translating !== null || !en.trim()}
        title="Translate EN → DE"
      >
        {#if translating === "en->de"}…{:else}←{/if}
      </button>
    </div>
    <div class="loc-col">
      <label>
        <span class="label-text">{label} (EN)</span>
        {#if multiline}
          <textarea
            {rows}
            bind:value={en}
            use:autoresize={en}
            oninput={() => onEnChange(en)}
          ></textarea>
        {:else}
          <input bind:value={en} oninput={() => onEnChange(en)} />
        {/if}
      </label>
      {#if enErrorPath}
        <FieldError path={enErrorPath} {errors} />
      {/if}
    </div>
  </div>
  {#if err}
    <p class="muted" style="color:#dc2626;font-size:11px;margin:2px 0 0;">
      {err}
    </p>
  {/if}
</div>

<style>
  .loc-field {
    margin-bottom: 8px;
  }
  .loc-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 8px;
    align-items: end;
  }
  .loc-controls {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-bottom: 4px;
  }
  .loc-controls .trans {
    padding: 2px 6px;
    font-size: 13px;
    line-height: 1;
    min-width: 28px;
    border-radius: 3px;
  }
</style>
