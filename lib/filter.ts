import type { Recipe } from "./types";
import { normaliseName } from "./synonyms";
import { timeRangeOf } from "./recipe-utils";

export type Filters = {
  query: string;
  include: string[]; // canonical ingredient names
  exclude: string[];
  match: "all" | "any";
  cuisines: string[];
  meals: string[];
  times: string[]; // TIME_RANGES ids
  tags: string[];
  favourites: boolean;
  collections: string[];
  /** Only recipes you haven't cooked yet. */
  untried: boolean;
};

export const EMPTY_FILTERS: Filters = {
  query: "",
  include: [],
  exclude: [],
  match: "all",
  cuisines: [],
  meals: [],
  times: [],
  tags: [],
  favourites: false,
  collections: [],
  untried: false,
};

export function activeFilterCount(f: Filters) {
  return (
    f.include.length + f.exclude.length + f.cuisines.length + f.meals.length +
    f.times.length + f.tags.length + (f.favourites ? 1 : 0) + f.collections.length + (f.untried ? 1 : 0)
  );
}

function recipeTags(r: Recipe) {
  return [...r.tags, ...r.suggestedTags];
}

// Built once per recipe version (recipes are replaced, never changed in place).
const textCache = new WeakMap<Recipe, string>();
function searchText(r: Recipe) {
  let t = textCache.get(r);
  if (t === undefined) textCache.set(r, (t = buildSearchText(r)));
  return t;
}
function buildSearchText(r: Recipe) {
  return [
    r.name,
    ...r.ingredients.map((i) => i.original),
    ...r.ingredients.map((i) => i.canonical),
    ...r.cuisines,
    ...r.meals,
    ...recipeTags(r),
  ]
    .join(" \u0000 ")
    .toLowerCase();
}

/**
 * Rules (from the brief):
 * - AND across filter groups
 * - OR within a multi-select group
 * - Ingredients follow the explicit ALL / ANY setting
 * - Excluded ingredients are always excluded
 */
export function applyFilters(recipes: Recipe[], f: Filters): Recipe[] {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  return recipes.filter((r) => {
    if (f.favourites && !r.favourite) return false;
    if (f.untried && (r.cookedCount ?? 0) > 0) return false;
    if (f.collections.length && !f.collections.some((c) => (r.collections ?? []).includes(c))) return false;

    if (words.length) {
      const hay = searchText(r);
      // every typed word must appear somewhere; synonyms are checked too
      const ok = words.every((w) => hay.includes(w) || hay.includes(normaliseName(w)));
      if (!ok) return false;
    }

    const have = new Set(r.ingredients.map((i) => i.canonical));
    if (f.exclude.some((x) => have.has(x))) return false;
    if (f.include.length) {
      const ok = f.match === "all" ? f.include.every((x) => have.has(x)) : f.include.some((x) => have.has(x));
      if (!ok) return false;
    }

    if (f.cuisines.length && !f.cuisines.some((c) => r.cuisines.includes(c))) return false;
    if (f.meals.length && !f.meals.some((m) => r.meals.includes(m))) return false;
    if (f.times.length) {
      const range = timeRangeOf(r);
      if (!range || !f.times.includes(range)) return false;
    }
    if (f.tags.length) {
      const t = recipeTags(r);
      if (!f.tags.some((x) => t.includes(x))) return false;
    }
    return true;
  });
}

/** Every canonical ingredient in the library, most common first (for the picker). */
export function allIngredients(recipes: Recipe[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of recipes) {
    for (const c of new Set(r.ingredients.map((i) => i.canonical).filter(Boolean))) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
