/** Svelte action: keep a `<textarea>` tall enough to show its full content.
 *  Usage: `<textarea bind:value={x} use:autoresize={x}>`. The value is passed
 *  as the action parameter so Svelte calls `update` whenever it changes,
 *  catching programmatic writes (e.g. translation results) that don't fire
 *  the native `input` event. */
export function autoresize(el: HTMLTextAreaElement, _value: unknown) {
  const adjust = () => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  // Wait one tick so the textarea is laid out and scrollHeight is meaningful.
  queueMicrotask(adjust);
  el.addEventListener("input", adjust);
  return {
    update: () => queueMicrotask(adjust),
    destroy: () => el.removeEventListener("input", adjust),
  };
}
