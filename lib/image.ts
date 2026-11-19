// Photo helpers. Recipe photos are kept small (1200 px, WebP where the browser
// supports it) because every photo is loaded when the cookbook opens.

export const PHOTO_MAX = 1200;

/** Encode a canvas as WebP (much smaller), falling back to JPEG where WebP isn't supported. */
export function encodePhoto(canvas: HTMLCanvasElement, quality = 0.8): string {
  const webp = canvas.toDataURL("image/webp", quality);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", quality);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Could not read that image"));
    i.src = src;
  });
}

function draw(source: CanvasImageSource, w: number, h: number, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Shrink a picked photo. `format: "jpeg"` is for sending screenshots to be read. */
export async function resizeImage(file: File, maxSide = PHOTO_MAX, quality = 0.8, format: "photo" | "jpeg" = "photo"): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = draw(img, img.naturalWidth, img.naturalHeight, maxSide);
    return format === "jpeg" ? canvas.toDataURL("image/jpeg", quality) : encodePhoto(canvas, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- Off the main thread ----------
// createImageBitmap decodes (and shrinks) in the background, and OffscreenCanvas
// encodes in the background, so background photo work never freezes the page.
export const canDecodeOffThread = () => typeof createImageBitmap === "function" && typeof OffscreenCanvas === "function";

/** Decode a photo in the background, optionally shrunk to `width` (keeping its shape). */
export async function decodeOffThread(src: string, width?: number): Promise<ImageBitmap> {
  const blob = await (await fetch(src)).blob();
  if (!width) return createImageBitmap(blob);
  const probe = await createImageBitmap(blob);
  const w = Math.min(width, probe.width), h = Math.max(1, Math.round((probe.height * w) / probe.width));
  probe.close();
  return createImageBitmap(blob, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
}

/** Encode a bitmap (or part of it) as a WebP/JPEG data: URL, in the background. */
export async function encodeOffThread(bmp: ImageBitmap, quality = 0.8, crop?: { x: number; w: number }, maxSide = PHOTO_MAX): Promise<string> {
  const sx = crop?.x ?? 0, sw = crop?.w ?? bmp.width, sh = bmp.height;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const c = new OffscreenCanvas(Math.round(sw * scale), Math.round(sh * scale));
  c.getContext("2d")!.drawImage(bmp, sx, 0, sw, sh, 0, 0, c.width, c.height);
  let blob = await c.convertToBlob({ type: "image/webp", quality });
  if (blob.type !== "image/webp") blob = await c.convertToBlob({ type: "image/jpeg", quality });
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Re-encode a stored photo smaller, if that saves a meaningful amount. Returns null if not worth it. */
export async function compactPhoto(dataUrl: string): Promise<string | null> {
  if (!dataUrl.startsWith("data:image/")) return null;
  let smaller: string;
  if (canDecodeOffThread()) {
    const bmp = await decodeOffThread(dataUrl);
    try { smaller = await encodeOffThread(bmp, 0.8); } finally { bmp.close(); }
  } else {
    const img = await loadImage(dataUrl);
    smaller = encodePhoto(draw(img, img.naturalWidth, img.naturalHeight, PHOTO_MAX));
  }
  return smaller.length < dataUrl.length * 0.8 ? smaller : null;
}

export function drawFrame(video: HTMLVideoElement, box?: [number, number, number, number] | null): string | null {
  const W = video.videoWidth, H = video.videoHeight;
  if (!W || !H) return null;
  if (!box) return encodePhoto(draw(video, W, H, PHOTO_MAX));
  // A square around the dish, with a little breathing room, kept inside the frame.
  const [y0, x0, y1, x1] = box.map((v) => v / 1000);
  const cx = ((x0 + x1) / 2) * W, cy = ((y0 + y1) / 2) * H;
  let side = Math.max((x1 - x0) * W, (y1 - y0) * H) * 1.12;
  side = Math.min(side, W, H);
  const sx = Math.min(Math.max(0, cx - side / 2), W - side);
  const sy = Math.min(Math.max(0, cy - side / 2), H - side);
  const out = Math.min(900, Math.round(side));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = out;
  canvas.getContext("2d")!.drawImage(video, sx, sy, side, side, 0, 0, out, out);
  return encodePhoto(canvas, 0.82);
}
