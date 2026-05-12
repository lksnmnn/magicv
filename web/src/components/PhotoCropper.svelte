<script lang="ts">
  // Square cropper for profile photos. User picks a file, drags a 1:1 box
  // over the preview, hits Apply → emits a cropped Blob (PNG).
  type Props = {
    file: File;
    onCancel: () => void;
    onCrop: (blob: Blob) => void;
  };
  let { file, onCancel, onCrop }: Props = $props();

  let imgEl = $state<HTMLImageElement | null>(null);
  let imgUrl = $state<string>("");
  let cropX = $state(0);
  let cropY = $state(0);
  let cropSize = $state(0); // displayed (CSS) pixels
  let natural = $state<{ w: number; h: number }>({ w: 0, h: 0 });
  let dragging = $state<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  let resizing = $state(false);

  $effect(() => {
    imgUrl = URL.createObjectURL(file);
    return () => URL.revokeObjectURL(imgUrl);
  });

  function onImgLoad() {
    if (!imgEl) return;
    natural = { w: imgEl.naturalWidth, h: imgEl.naturalHeight };
    const rect = imgEl.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    cropSize = size;
    cropX = (rect.width - size) / 2;
    cropY = (rect.height - size) / 2;
  }

  function onPointerDown(e: PointerEvent) {
    if (!imgEl) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragging = {
      startX: e.clientX,
      startY: e.clientY,
      origX: cropX,
      origY: cropY,
    };
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging || !imgEl) return;
    const rect = imgEl.getBoundingClientRect();
    const dx = e.clientX - dragging.startX;
    const dy = e.clientY - dragging.startY;
    cropX = Math.max(0, Math.min(rect.width - cropSize, dragging.origX + dx));
    cropY = Math.max(0, Math.min(rect.height - cropSize, dragging.origY + dy));
  }
  function onPointerUp() {
    dragging = null;
  }

  function nudgeSize(delta: number) {
    if (!imgEl) return;
    const rect = imgEl.getBoundingClientRect();
    const minSize = 40;
    const maxSize = Math.min(rect.width, rect.height);
    const next = Math.max(minSize, Math.min(maxSize, cropSize + delta));
    // Keep crop inside the image after resize.
    const cx = cropX + cropSize / 2;
    const cy = cropY + cropSize / 2;
    cropSize = next;
    cropX = Math.max(0, Math.min(rect.width - next, cx - next / 2));
    cropY = Math.max(0, Math.min(rect.height - next, cy - next / 2));
  }

  async function apply() {
    if (!imgEl) return;
    resizing = true;
    try {
      const rect = imgEl.getBoundingClientRect();
      const scaleX = natural.w / rect.width;
      const scaleY = natural.h / rect.height;
      const srcX = cropX * scaleX;
      const srcY = cropY * scaleY;
      const srcSize = cropSize * scaleX;

      // Render at 600x600 (high enough for a sharp 36mm @ 300dpi).
      const target = 600;
      const canvas = document.createElement("canvas");
      canvas.width = target;
      canvas.height = target;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d ctx");
      ctx.drawImage(imgEl, srcX, srcY, srcSize, srcSize, 0, 0, target, target);
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("toBlob failed");
      onCrop(blob);
    } finally {
      resizing = false;
    }
  }
</script>

<div class="cropper">
  <div class="canvas-wrap">
    <img
      bind:this={imgEl}
      src={imgUrl}
      alt="To crop"
      onload={onImgLoad}
      draggable="false"
    />
    <div
      class="crop-box"
      style="left: {cropX}px; top: {cropY}px; width: {cropSize}px; height: {cropSize}px;"
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      role="application"
      aria-label="Crop region (drag to reposition)"
    ></div>
  </div>
  <div class="row" style="gap: 8px; margin-top: 10px; flex-wrap: wrap;">
    <span class="muted" style="font-size:12px;">Drag the box · resize:</span>
    <button type="button" onclick={() => nudgeSize(-20)}>−</button>
    <button type="button" onclick={() => nudgeSize(20)}>+</button>
    <span style="flex: 1;"></span>
    <button type="button" onclick={onCancel}>Cancel</button>
    <button class="primary" type="button" onclick={apply} disabled={resizing}>
      {resizing ? "Cropping…" : "Apply crop & upload"}
    </button>
  </div>
</div>

<style>
  .cropper {
    background: #fafafa;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px;
    margin-top: 10px;
  }
  .canvas-wrap {
    position: relative;
    display: inline-block;
    max-width: 100%;
  }
  .canvas-wrap img {
    display: block;
    max-width: min(420px, 100%);
    max-height: 420px;
    user-select: none;
    -webkit-user-drag: none;
  }
  .crop-box {
    position: absolute;
    border: 2px solid #0f766e;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4);
    cursor: move;
    box-sizing: border-box;
  }
</style>
