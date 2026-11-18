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

/** Turn any Instagram URL into its shortcode: instagram.com/reel/ABC?igsh=.. -> ABC */
export function instagramShortcode(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (!/(^|\.)instagram\.com$/i.test(u.hostname) && !/(^|\.)instagr\.am$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function canonicalInstagramUrl(shortcode: string) {
  return `https://www.instagram.com/reel/${shortcode}/`;
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
    originalCaption: null,
    sourceTranscript: null,
    importNotes: null,
    favourite: false,
  };
}
