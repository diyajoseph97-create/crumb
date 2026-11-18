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

/** Re-encode a stored photo smaller, if that saves a meaningful amount. Returns null if not worth it. */
export async function compactPhoto(dataUrl: string): Promise<string | null> {
  if (!dataUrl.startsWith("data:image/")) return null;
  const img = await loadImage(dataUrl);
  const smaller = encodePhoto(draw(img, img.naturalWidth, img.naturalHeight, PHOTO_MAX));
  return smaller.length < dataUrl.length * 0.8 ? smaller : null;
}

export function drawFrame(video: HTMLVideoElement): string | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  return encodePhoto(draw(video, video.videoWidth, video.videoHeight, PHOTO_MAX));
}
