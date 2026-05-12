<script lang="ts">
  import type { Quote } from "../lib/api";
  import { autoresize } from "../lib/autoresize";

  let { items = $bindable<Quote[]>([]) }: { items: Quote[] } = $props();

  function add() {
    items = [...items, { text: "", author: "", role: "" }];
  }
  function remove(i: number) {
    items = items.filter((_, idx) => idx !== i);
  }
</script>

<div class="field-label">Customer quotes</div>
{#each items as _, i (i)}
  <div class="quote-row">
    <textarea
      rows="3"
      bind:value={items[i]!.text}
      use:autoresize={items[i]!.text}
      placeholder="Quote text…"
      aria-label="Quote text"
    ></textarea>
    <div class="quote-meta">
      <input
        bind:value={items[i]!.author}
        placeholder="Author"
        aria-label="Quote author"
      />
      <input
        bind:value={items[i]!.role}
        placeholder="Role / company"
        aria-label="Quote author role"
      />
      <button
        class="danger"
        onclick={() => remove(i)}
        aria-label="Remove quote"
      >
        ×
      </button>
    </div>
  </div>
{/each}
<button onclick={add}>+ Add quote</button>

<style>
  .quote-row {
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 8px;
    background: #fafafa;
  }
  .quote-row textarea {
    margin-bottom: 6px;
  }
  .quote-meta {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 6px;
  }
</style>
