// crumbs "reel" helper (a Supabase Edge Function).
// Given an Instagram Reel/post code, it reads the public embed page that Instagram
// serves for embeds and link previews, and returns only:
//   { caption, creator, image }   (image is a small data: URL of the cover)
// It accepts nothing but a short code, so it can't be used to fetch other sites.

const ALLOWED_ORIGINS = ["https://diyajoseph97-create.github.io", "http://localhost:8765"];
const CODE = /^[A-Za-z0-9_-]{5,40}$/;

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  };
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decode(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function readCaption(html: string): { caption: string | null; creator: string | null } {
  const start = html.indexOf('<div class="Caption">');
  if (start < 0) return { caption: null, creator: null };
  let end = html.indexOf('<div class="CaptionComments"', start);
  if (end < 0) end = html.indexOf("</div>", start);
  let block = html.slice(start, end);
  const user = block.match(/class="CaptionUsername"[^>]*>([^<]+)<\/a>/);
  block = block.replace(/<a class="CaptionUsername"[^>]*>[^<]*<\/a>/, "");
  const text = decode(
    block
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/ /g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { caption: text || null, creator: user ? decode(user[1]).trim() : null };
}

function readImage(html: string): string | null {
  const m = html.match(/<img class="EmbeddedMediaImage"[^>]*\ssrc="([^"]+)"/);
  return m ? decode(m[1]) : null;
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const u = new URL(url);
    if (!/(\.cdninstagram\.com|\.fbcdn\.net)$/.test(u.hostname)) return null;
    const r = await fetch(u, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const type = r.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > 3_000_000) return null;
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

const UA = "Mozilla/5.0 (compatible; crumbs-cookbook/1.0; +https://diyajoseph97-create.github.io/crumb/)";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = { ...cors(origin), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const code = new URL(req.url).searchParams.get("code") || "";
  if (!CODE.test(code)) return new Response(JSON.stringify({ error: "bad code" }), { status: 400, headers });

  try {
    let html = "";
    for (const kind of ["reel", "p"]) {
      const r = await fetch(`https://www.instagram.com/${kind}/${code}/embed/captioned/`, { headers: { "User-Agent": UA, "Accept-Language": "en" }, redirect: "follow" });
      if (r.ok) {
        html = await r.text();
        if (html.includes('class="Caption"') || html.includes("EmbeddedMediaImage")) break;
      }
    }
    const { caption, creator } = readCaption(html);
    const imageUrl = readImage(html);
    const image = imageUrl ? await toDataUrl(imageUrl) : null;
    return new Response(JSON.stringify({ caption, creator, image }), { headers: { ...headers, "Cache-Control": "public, max-age=3600" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e).slice(0, 200) }), { status: 502, headers });
  }
});
