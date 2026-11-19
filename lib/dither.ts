// Turns a recipe photo into black-and-white dots (Floyd–Steinberg dithering), so the
// home grid looks like one set however the Reel was lit. Done in the browser, one
// photo at a time when the page is idle, and kept in memory for the session.

const SIZE = 240; // dots across; shown larger with crisp pixels
const DARK = [17, 17, 17];
const LIGHT = [250, 250, 248];

const done = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();
let chain: Promise<unknown> = Promise.resolve();

export const ditheredNow = (src: string) => done.get(src);

export function dither(src: string): Promise<string | null> {
  const hit = done.get(src);
  if (hit) return Promise.resolve(hit);
  const wait = pending.get(src);
  if (wait) return wait;
  // One at a time, in idle moments, so scrolling stays smooth.
  const job: Promise<string | null> = chain.then(() => idle()).then(() => make(src));
  chain = job.catch(() => null);
  const p = job.then(
    (out) => {
      pending.delete(src);
      if (out) done.set(src, out);
      return out;
    },
    () => {
      pending.delete(src);
      return null;
    },
  ) as Promise<string | null>;
  pending.set(src, p);
  return p;
}

function idle() {
  return new Promise<void>((res) => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    if (ric) ric(() => res(), { timeout: 300 });
    else setTimeout(res, 16);
  });
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("load"));
    img.src = src;
  });
}

async function make(src: string): Promise<string | null> {
  const img = await load(src);
  const w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h) return null;
  const side = Math.min(w, h);
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, SIZE, SIZE);
  const data = ctx.getImageData(0, 0, SIZE, SIZE); // throws if the image won't allow it
  const px = data.data;
  const n = SIZE * SIZE;
  const g = new Float32Array(n);
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const v = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    g[i] = v;
    hist[v | 0]++;
  }
  // Stretch the tones (ignore the darkest and lightest 1%), then lift the shadows so
  // the dots stay light and the dish reads clearly.
  let lo = 0, hi = 255, acc = 0;
  for (; lo < 255 && (acc += hist[lo]) < n * 0.01; lo++);
  acc = 0;
  for (; hi > 0 && (acc += hist[hi]) < n * 0.01; hi--);
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < n; i++) {
    let t = Math.min(1, Math.max(0, (g[i] - lo) / span));
    t = Math.pow(t, 0.62);
    t = Math.min(1, Math.max(0, (t - 0.5) * 1.1 + 0.5));
    g[i] = t * 255;
  }
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const old = g[i];
      const on = old >= 128;
      const err = old - (on ? 255 : 0);
      const col = on ? LIGHT : DARK;
      px[i * 4] = col[0]; px[i * 4 + 1] = col[1]; px[i * 4 + 2] = col[2]; px[i * 4 + 3] = 255;
      if (x + 1 < SIZE) g[i + 1] += (err * 7) / 16;
      if (y + 1 < SIZE) {
        if (x > 0) g[i + SIZE - 1] += (err * 3) / 16;
        g[i + SIZE] += (err * 5) / 16;
        if (x + 1 < SIZE) g[i + SIZE + 1] += err / 16;
      }
    }
  }
  ctx.putImageData(data, 0, 0);
  return c.toDataURL("image/png");
}
