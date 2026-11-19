// Instagram shows tall videos inside a wider frame by padding the sides with a
// blurred, darkened copy of the same video. Those bars end in a straight vertical
// line where the real picture starts, which ordinary food photos never have.
// We look for that line on both sides and crop the bars off.
import { encodePhoto } from "./image";

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("load"));
    img.src = src;
  });
}

const median = (a: Float32Array) => {
  const s = Array.from(a).sort((x, y) => x - y);
  return s[s.length >> 1] ?? 0;
};

/** Where the real picture starts and ends (0–1 of the width), or null if there are no side bars. */
export function findSideBars(gray: Float32Array, w: number, h: number): [number, number] | null {
  const n = w - 1;
  const line = new Float32Array(n);
  const col = new Float32Array(h);
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < h; y++) col[y] = Math.abs(gray[y * w + x + 1] - gray[y * w + x]);
    line[x] = median(col); // a straight boundary is strong in every row
  }
  const typical = Math.max(1, median(line));
  const peak = (a: number, b: number) => {
    let best = a;
    for (let x = a; x < b; x++) if (line[x] > line[best]) best = x;
    return best;
  };
  const lt = peak(Math.floor(n * 0.05), Math.floor(n * 0.45));
  const rt = peak(Math.floor(n * 0.55), Math.floor(n * 0.95));
  const strong = (v: number) => v >= Math.max(20, 8 * typical);
  const L = lt / n, R = (rt + 1) / n;
  if (!strong(line[lt]) || !strong(line[rt]) || Math.abs(L - (1 - R)) > 0.06) return null;
  return [L, R];
}

/** A copy of the photo with Instagram's blurred side bars cropped off, or null if it has none. */
export async function trimSideBars(src: string): Promise<string | null> {
  const img = await load(src);
  const W = img.naturalWidth, H = img.naturalHeight;
  if (!W || !H) return null;
  const w = 240, h = Math.max(20, Math.round((H * w) / W));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  const bars = findSideBars(gray, w, h);
  if (!bars) return null;
  // Crop just inside the line so no trace of the bar is left.
  const x0 = Math.round((bars[0] + 0.006) * W), x1 = Math.round((bars[1] - 0.006) * W);
  const out = document.createElement("canvas");
  out.width = x1 - x0; out.height = H;
  out.getContext("2d")!.drawImage(img, x0, 0, x1 - x0, H, 0, 0, x1 - x0, H);
  return encodePhoto(out, 0.85);
}

/** Same as trimSideBars, but never throws: returns the original if nothing to do. */
export async function cleanPhoto(src: string | null): Promise<string | null> {
  if (!src || !(src.startsWith("data:image/") || src.startsWith("https://i.ytimg.com/"))) return src;
  try {
    return (await trimSideBars(src)) ?? src;
  } catch {
    return src;
  }
}
