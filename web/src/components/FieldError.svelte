<script lang="ts">
  /** Renders a small inline error if `errors[path]` is set.
   *  Pass the same `errors` map at every level; child components prepend
   *  their own prefix to look up nested paths like "highlights.0.de". */
  let {
    path,
    errors = {},
  }: {
    path: string;
    errors?: Record<string, string>;
  } = $props();
</script>

{#if errors[path]}
  <p class="field-error">{errors[path]}</p>
{/if}

<style>
  .field-error {
    color: #dc2626;
    font-size: 11px;
    margin: 2px 0 0;
    line-height: 1.3;
  }
</style>
