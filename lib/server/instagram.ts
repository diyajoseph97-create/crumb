// Getting content out of an Instagram Reel.
// Instagram doesn't offer an official way to read other people's posts, so we try,
// in order: (A) the public embed / link-preview pages (free, often blocked),
// then (B) Apify's Instagram scraper if an APIFY_TOKEN is set (paid per use).
// Whatever we get is passed on; nothing is made up here.

export type InstagramContent = {
  caption: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  method: "embed" | "preview" | "apify" | "none";
  notes: string[];
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function meta(html: string, prop: string) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, "i");
  const m = html.match(re) ?? html.match(re2);
  return m ? decodeEntities(m[1]) : null;
}

async function get(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", Accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** The embed page sometimes includes the video file's address inside its page data. */
export function findVideoUrl(html: string): string | null {
  const unescape = (t: string) =>
    t
      .replace(/\\+\//g, "/") // \/ or \\/ -> /
      .replace(/\\+u0026/gi, "&") // \u0026 -> &
      .replace(/&amp;/g, "&");
  const i = html.search(/video_url/);
  if (i >= 0) {
    // the link must come right after the label, e.g. video_url":"https://…
    const m = unescape(html.slice(i, i + 3000)).match(/^video_url[\\"'\s:]{1,12}(https:\/\/[^"'\\\s<>]+)/);
    if (m) return m[1];
  }
  const tag = html.match(/<video[^>]+src="([^"]+)"/i) ?? html.match(/<meta[^>]+property="og:video(?::secure_url)?"[^>]+content="([^"]+)"/i);
  if (tag) {
    const url = decodeEntities(tag[1]);
    if (/^https:\/\//.test(url)) return url;
  }
  return null;
}

/** A: Instagram's "captioned embed" page often contains the full caption. */
async function tryEmbed(code: string): Promise<Partial<InstagramContent>> {
  const html = await get(`https://www.instagram.com/p/${code}/embed/captioned/`);
  let caption: string | null = null;
  const capBlock = html.match(/<div class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments"/i);
  if (capBlock) {
    caption = decodeEntities(
      capBlock[1]
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<a[^>]*class="CaptionUsername"[^>]*>[\s\S]*?<\/a>/i, "")
        .replace(/<[^>]+>/g, "")
    ).trim();
  }
  const img = html.match(/<img[^>]+class="EmbeddedMediaImage"[^>]+src="([^"]+)"/i);
  return { caption: caption || null, imageUrl: img ? decodeEntities(img[1]) : null, videoUrl: findVideoUrl(html) };
}

/** A (fallback): the normal page's link-preview tags (caption is often cut short). */
async function tryPreview(code: string): Promise<Partial<InstagramContent>> {
  const html = await get(`https://www.instagram.com/reel/${code}/`);
  const desc = meta(html, "og:description") ?? meta(html, "description");
  let caption: string | null = null;
  if (desc) {
    // Usually: '1,234 likes, 56 comments - user on May 1, 2026: "caption…"'
    const q = desc.match(/:\s*["“](.*)["”]\s*\.?\s*$/s);
    caption = (q ? q[1] : desc).trim();
  }
  return { caption, imageUrl: meta(html, "og:image"), videoUrl: findVideoUrl(html) };
}

/** B: Apify scraper — more reliable for public posts, small cost per run. Also returns the video file. */
export async function fetchApify(url: string): Promise<Partial<InstagramContent>> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return {};
  const res = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=50`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directUrls: [url], resultsType: "posts", resultsLimit: 1, addParentData: false }),
      signal: AbortSignal.timeout(55000),
    }
  );
  if (!res.ok) throw new Error(`Apify HTTP ${res.status}`);
  const items = (await res.json()) as any[];
  const item = items?.[0];
  if (!item || item.error) return {};
  return { caption: item.caption ?? null, imageUrl: item.displayUrl ?? item.images?.[0] ?? null, videoUrl: item.videoUrl ?? null };
}

const usable = (c?: string | null) => Boolean(c && c.trim().length >= 40);

export async function fetchInstagram(code: string, url: string): Promise<InstagramContent> {
  const notes: string[] = [];
  let best: InstagramContent = { caption: null, imageUrl: null, videoUrl: null, method: "none", notes };

  for (const [method, fn] of [
    ["embed", () => tryEmbed(code)],
    ["preview", () => tryPreview(code)],
  ] as const) {
    try {
      const r = await fn();
      if (!best.imageUrl && r.imageUrl) best.imageUrl = r.imageUrl;
      if (!best.videoUrl && r.videoUrl) best.videoUrl = r.videoUrl;
      if ((r.caption?.length ?? 0) > (best.caption?.length ?? 0)) {
        best.caption = r.caption!;
        best.method = method;
      }
      if (usable(best.caption) && best.videoUrl) break;
    } catch {
      /* try next method */
    }
  }

  // Use the paid fetcher when the free methods didn't get the caption or the video.
  if ((!usable(best.caption) || !best.videoUrl) && process.env.APIFY_TOKEN) {
    try {
      const r = await fetchApify(url);
      if (r.caption && r.caption.length > (best.caption?.length ?? 0)) {
        best.caption = r.caption;
        best.method = "apify";
      }
      if (r.imageUrl && !best.imageUrl) best.imageUrl = r.imageUrl;
      if (r.videoUrl && !best.videoUrl) best.videoUrl = r.videoUrl;
    } catch {
      notes.push("The backup Instagram fetcher didn't respond.");
    }
  }

  if (!best.caption) notes.push("Instagram didn't share this post's caption (it may be private, or Instagram blocked the request).");
  return best;
}
