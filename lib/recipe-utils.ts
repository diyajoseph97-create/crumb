import type { Recipe, RecipeDraft } from "./types";
import { TIME_RANGES } from "./constants";

export function totalMinutes(r: Pick<Recipe, "prepMinutes" | "cookMinutes">): number | null {
  if (r.prepMinutes == null && r.cookMinutes == null) return null;
  // Only add up the parts we know. If one is unknown, the total is a minimum.
  return (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);
}

export function totalIsPartial(r: Pick<Recipe, "prepMinutes" | "cookMinutes">) {
  return (r.prepMinutes == null) !== (r.cookMinutes == null);
}

export function formatMinutes(m: number | null): string {
  if (m == null) return "—";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} hr ${rest} min` : `${h} hr`;
}

const NO_QUANTITY_OK = /(to taste|as needed|as required|for garnish|for frying|pinch|a little|few|handful|optional)/i;

/** What's missing from a recipe. Empty list = complete. Computed, never guessed. */
export function missingParts(r: RecipeDraft | Recipe): string[] {
  const missing: string[] = [];
  if (!r.name.trim()) missing.push("name");
  if (r.ingredients.length === 0) missing.push("ingredients");
  else {
    const noQty = r.ingredients.filter(
      (i) => !/[\d¼½¾⅓⅔⅛]/.test(i.original) && !NO_QUANTITY_OK.test(i.original)
    ).length;
    if (noQty > 0) missing.push(`quantities for ${noQty} ingredient${noQty > 1 ? "s" : ""}`);
  }
  if (r.steps.length === 0) missing.push("instructions");
  if (r.prepMinutes == null && r.cookMinutes == null) missing.push("cooking time");
  if (!r.servings) missing.push("serving size");
  return missing;
}

export function isIncomplete(r: RecipeDraft | Recipe) {
  const m = missingParts(r);
  // name, ingredients, quantities and instructions are what make a recipe cookable
  return m.some((x) => x === "ingredients" || x === "instructions" || x.startsWith("quantities") || x === "name");
}

/** A link saved with nothing read yet: lives in "Saved for later", not the gallery. */
export function isSavedForLater(r: Recipe) {
  return r.ingredients.length === 0 && r.steps.length === 0 && Boolean(r.sourceUrl);
}

export function timeRangeOf(r: Recipe): string | null {
  const t = totalMinutes(r);
  if (t == null) return null;
  return TIME_RANGES.find((x) => x.test(t))?.id ?? null;
}

// ---------- Where a recipe came from: Instagram or YouTube ----------
// Each source gets a short "key" used to spot duplicates:
//   Instagram  ABC123 (or share/reel/ID for newer share links)
//   YouTube    yt:VIDEOID

function youtubeId(u: URL): string | null {
  const host = u.hostname.replace(/^(www|m|music)\./i, "").toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else id = u.pathname.match(/^\/(?:shorts|live|embed|v)\/([^/?#]+)/)?.[1] ?? null;
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/** Turn an Instagram or YouTube link into its key: instagram.com/reel/ABC?igsh=.. -> ABC, youtu.be/XYZ -> yt:XYZ */
export function instagramShortcode(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const yt = youtubeId(u);
    if (yt) return `yt:${yt}`;
    if (!/(^|\.)instagram\.com$/i.test(u.hostname) && !/(^|\.)instagr\.am$/i.test(u.hostname)) return null;
    // Newer app share links: instagram.com/share/reel/BAxyz… or instagram.com/share/BAxyz…
    const share = u.pathname.match(/^\/share\/(?:(reel|reels|p|tv)\/)?([A-Za-z0-9_-]+)/i);
    if (share) return `share/${share[1] ? "reel/" : ""}${share[2]}`;
    const m = u.pathname.match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function canonicalInstagramUrl(key: string) {
  if (key.startsWith("yt:")) return `https://www.youtube.com/watch?v=${key.slice(3)}`;
  if (key.startsWith("share/")) return `https://www.instagram.com/${key}/`;
  return `https://www.instagram.com/reel/${key}/`;
}

export const isYouTube = (urlOrKey: string | null | undefined) =>
  Boolean(urlOrKey && (urlOrKey.startsWith("yt:") || /youtu\.?be/i.test(urlOrKey)));
export const youtubeVideoId = (urlOrKey: string | null | undefined): string | null => {
  if (!urlOrKey) return null;
  const k = urlOrKey.startsWith("yt:") ? urlOrKey : instagramShortcode(urlOrKey);
  return k && k.startsWith("yt:") ? k.slice(3) : null;
};

/** Finds an Instagram or YouTube link inside any text. */
export const SOURCE_LINK =
  /https?:\/\/(?:(?:www\.|m\.)?(?:instagram\.com|instagr\.am)\/(?:share\/)?(?:(?:reel|reels|p|tv)\/)?[A-Za-z0-9_-]{5,}|(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?[^\s]*v=|shorts\/|live\/|embed\/)|youtu\.be\/)[A-Za-z0-9_-]{11})\/?(?:[?&][^\s]*)?/i;

/** The channel behind a YouTube video, from YouTube's public oEmbed: "@handle", else the channel name. */
export async function youtubeCreator(id: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`);
    if (!res.ok) return null;
    const o = await res.json();
    const handle = typeof o.author_url === "string" ? o.author_url.match(/\/(@[\w.-]+)/)?.[1] : null;
    return handle || (typeof o.author_name === "string" && o.author_name.trim() ? o.author_name.trim().slice(0, 80) : null);
  } catch {
    return null;
  }
}

/** Best available YouTube thumbnail (maxres when it exists, else hq). */
export async function youtubeThumbnail(id: string): Promise<string> {
  const max = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
  const ok = await new Promise<boolean>((res) => {
    const img = new Image();
    img.onload = () => res(img.naturalWidth > 200); // a missing image is a 120px placeholder
    img.onerror = () => res(false);
    img.src = max;
  });
  return ok ? max : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function emptyDraft(): RecipeDraft {
  return {
    name: "",
    imageUrl: null,
    ingredients: [],
    steps: [],
    prepMinutes: null,
    cookMinutes: null,
    servings: null,
    timesEstimated: false,
    servingsEstimated: false,
    sourceUrl: null,
    sourceShortcode: null,
    cuisines: [],
    meals: [],
    tags: [],
    suggestedTags: [],
    nutrition: null,
    healthTips: null,
    creator: null,
    myNotes: null,
    collections: [],
    cookedCount: 0,
    lastCookedAt: null,
    rating: null,
    originalCaption: null,
    sourceTranscript: null,
    importNotes: null,
    favourite: false,
  };
}
