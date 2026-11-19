// Cleans AI output and saved data so only known fields and values are kept.
import type { Ingredient, Nutrition, Recipe } from "./types";
import { CUISINES, MEALS, TAGS } from "./constants";
import { canonicalise, normaliseName } from "./synonyms";
import { newId } from "./recipe-utils";

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.slice(0, max) : "");
export const num = (v: unknown, max = 100000) =>
  typeof v === "number" && isFinite(v) && v >= 0 ? Math.min(Math.round(v * 10) / 10, max) : null;
export const pick = (v: unknown, allowed: readonly string[]) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && allowed.includes(x)))] : [];

export function cleanIngredients(v: unknown): Ingredient[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, 80)
    .map((i: any) => {
      const original = str(i?.original, 300).trim();
      const canonical = normaliseName(str(i?.canonical, 80)) || canonicalise(original);
      return { id: str(i?.id, 64) || newId(), original, canonical };
    })
    .filter((i) => i.original);
}

export function cleanNutrition(v: unknown): Nutrition | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const n: Nutrition = {
    calories: num(o.calories, 10000),
    protein: num(o.protein, 1000),
    carbs: num(o.carbs, 1000),
    fat: num(o.fat, 1000),
    fibre: num(o.fibre, 1000),
  };
  return Object.values(n).some((x) => x != null) ? n : null;
}

/** Makes sure a recipe read back from storage has every field. */
export function normaliseRecipe(r: any): Recipe {
  return {
    id: str(r.id, 64),
    name: str(r.name, 200),
    imageUrl: r.imageUrl ? str(r.imageUrl, 3000000) : null,
    ingredients: cleanIngredients(r.ingredients),
    steps: Array.isArray(r.steps) ? r.steps.filter((s: unknown) => typeof s === "string") : [],
    prepMinutes: num(r.prepMinutes),
    cookMinutes: num(r.cookMinutes),
    servings: num(r.servings),
    timesEstimated: Boolean(r.timesEstimated),
    servingsEstimated: Boolean(r.servingsEstimated),
    sourceUrl: r.sourceUrl ? str(r.sourceUrl, 500) : null,
    sourceShortcode: r.sourceShortcode ? str(r.sourceShortcode, 64) : null,
    cuisines: pick(r.cuisines, CUISINES),
    meals: pick(r.meals, MEALS),
    tags: pick(r.tags, TAGS),
    suggestedTags: pick(r.suggestedTags, TAGS),
    nutrition: cleanNutrition(r.nutrition),
    healthTips: cleanTips(r.healthTips),
    creator: typeof r.creator === "string" && r.creator.trim() ? r.creator.trim().slice(0, 80) : null,
    myNotes: typeof r.myNotes === "string" && r.myNotes.trim() ? r.myNotes.slice(0, 4000) : null,
    collections: Array.isArray(r.collections) ? [...new Set((r.collections as unknown[]).filter((c): c is string => typeof c === "string" && c.trim() !== "").map((c) => c.trim().slice(0, 40)))].slice(0, 20) : [],
    cookedCount: Number.isInteger(r.cookedCount) && r.cookedCount > 0 ? r.cookedCount : 0,
    lastCookedAt: typeof r.lastCookedAt === "string" ? r.lastCookedAt : null,
    rating: Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5 ? r.rating : null,
    originalCaption: r.originalCaption ? str(r.originalCaption, 20000) : null,
    importNotes: r.importNotes ? str(r.importNotes, 2000) : null,
    favourite: Boolean(r.favourite),
    createdAt: str(r.createdAt, 40) || new Date().toISOString(),
    updatedAt: str(r.updatedAt, 40) || new Date().toISOString(),
  };
}

export function cleanTips(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const tips = v.filter((t) => typeof t === "string" && t.trim()).map((t: string) => t.trim().slice(0, 200)).slice(0, 5);
  return tips.length ? tips : null;
}
