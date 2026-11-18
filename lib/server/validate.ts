// Cleans anything sent to the server so only known fields and values are saved.
import type { Ingredient, Nutrition, RecipeDraft } from "@/lib/types";
import { CUISINES, MEALS, TAGS } from "@/lib/constants";
import { canonicalise, normaliseName } from "@/lib/synonyms";
import { instagramShortcode, newId } from "@/lib/recipe-utils";

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown, max = 100000) =>
  typeof v === "number" && isFinite(v) && v >= 0 ? Math.min(Math.round(v * 10) / 10, max) : null;
const pick = (v: unknown, allowed: readonly string[]) =>
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

/** For PATCH: only fields that were sent are returned. */
export function cleanPatch(body: any): Partial<RecipeDraft> {
  const out: Partial<RecipeDraft> = {};
  if (!body || typeof body !== "object") return out;
  if ("name" in body) out.name = str(body.name, 200).trim();
  if ("imageUrl" in body) out.imageUrl = body.imageUrl ? str(body.imageUrl, 2000) : null;
  if ("ingredients" in body) out.ingredients = cleanIngredients(body.ingredients);
  if ("steps" in body) out.steps = Array.isArray(body.steps) ? body.steps.map((s: unknown) => str(s, 3000).trim()).filter(Boolean).slice(0, 60) : [];
  if ("prepMinutes" in body) out.prepMinutes = num(body.prepMinutes, 10000);
  if ("cookMinutes" in body) out.cookMinutes = num(body.cookMinutes, 10000);
  if ("servings" in body) out.servings = num(body.servings, 500);
  if ("timesEstimated" in body) out.timesEstimated = Boolean(body.timesEstimated);
  if ("servingsEstimated" in body) out.servingsEstimated = Boolean(body.servingsEstimated);
  if ("sourceTranscript" in body) out.sourceTranscript = body.sourceTranscript ? str(body.sourceTranscript, 20000) : null;
  if ("sourceUrl" in body) {
    out.sourceUrl = body.sourceUrl ? str(body.sourceUrl, 500) : null;
    out.sourceShortcode = out.sourceUrl ? instagramShortcode(out.sourceUrl) : null;
  }
  if ("cuisines" in body) out.cuisines = pick(body.cuisines, CUISINES);
  if ("meals" in body) out.meals = pick(body.meals, MEALS);
  if ("tags" in body) out.tags = pick(body.tags, TAGS);
  if ("suggestedTags" in body) out.suggestedTags = pick(body.suggestedTags, TAGS);
  if ("nutrition" in body) out.nutrition = cleanNutrition(body.nutrition);
  if ("originalCaption" in body) out.originalCaption = body.originalCaption ? str(body.originalCaption, 20000) : null;
  if ("importNotes" in body) out.importNotes = body.importNotes ? str(body.importNotes, 2000) : null;
  if ("favourite" in body) out.favourite = Boolean(body.favourite);
  if (out.tags && out.suggestedTags) out.suggestedTags = out.suggestedTags.filter((t) => !out.tags!.includes(t));
  return out;
}

export function cleanDraft(body: any): RecipeDraft {
  const p = cleanPatch(body);
  return {
    name: p.name ?? "",
    imageUrl: p.imageUrl ?? null,
    ingredients: p.ingredients ?? [],
    steps: p.steps ?? [],
    prepMinutes: p.prepMinutes ?? null,
    cookMinutes: p.cookMinutes ?? null,
    servings: p.servings ?? null,
    timesEstimated: p.timesEstimated ?? false,
    servingsEstimated: p.servingsEstimated ?? false,
    sourceUrl: p.sourceUrl ?? null,
    sourceShortcode: p.sourceShortcode ?? null,
    cuisines: p.cuisines ?? [],
    meals: p.meals ?? [],
    tags: p.tags ?? [],
    suggestedTags: p.suggestedTags ?? [],
    nutrition: p.nutrition ?? null,
    originalCaption: p.originalCaption ?? null,
    sourceTranscript: p.sourceTranscript ?? null,
    importNotes: p.importNotes ?? null,
    favourite: p.favourite ?? false,
  };
}
