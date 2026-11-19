// Read an Instagram Reel's public caption, cover and creator through the crumbs
// helper on your Supabase project (supabase/functions/reel). Instagram blocks
// browsers from reading it directly. Returns null if anything goes wrong.
import { getConfig } from "./cloud";

export type ReelPreview = { caption: string | null; creator: string | null; image: string | null };

export async function fetchReelPreview(code: string): Promise<ReelPreview | null> {
  const cfg = getConfig();
  if (!cfg || !/^[A-Za-z0-9_-]{5,40}$/.test(code)) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(`${cfg.url.replace(/\/$/, "")}/functions/v1/reel?code=${encodeURIComponent(code)}`, {
      headers: { apikey: cfg.key },
      signal: ctl.signal,
    });
    if (!r.ok) return null;
    const j = await r.json();
    return { caption: j.caption || null, creator: j.creator || null, image: typeof j.image === "string" && j.image.startsWith("data:image/") ? j.image : null };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** A data: URL as a File, so Gemini can look at the cover too. */
export function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, b64] = dataUrl.split(",");
  const type = head.match(/data:([^;]+)/)?.[1] || "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type });
}
