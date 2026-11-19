// Nutrition worked out from the ingredients, using measured food values
// (IFCT 2017 for Indian foods, USDA SR for the rest: see data/foods.json and
// scripts/build_foods.py). Each line's amount is turned into grams, multiplied
// by the food's values per 100 g, and added up. Lines that can't be counted
// ("oil for frying", unknown ingredients) are listed, never guessed.
import type { Nutrition, Recipe } from "./types";
import { canonicalise } from "./synonyms";
import { NUTRITION_THRESHOLDS } from "./constants";

/** One food: name, other names, per-100 g [kcal, protein, fat, carbs, fibre], grams per measure, source. */
export type Food = { n: string; a: string[]; v: [number, number, number, number, number]; g: Record<string, number>; s: string };

let foodsP: Promise<Food[]> | null = null;
/** The food table (26 KB), fetched once and kept for offline use by the service worker. */
export function loadFoods(): Promise<Food[]> {
  foodsP ??= fetch("foods.json").then((r) => {
    if (!r.ok) throw new Error("foods");
    return r.json();
  });
  foodsP.catch(() => { foodsP = null; });
  return foodsP;
}

type Index = { exact: Map<string, Food>; names: { key: string; food: Food }[] };
const indexes = new WeakMap<Food[], Index>();
function indexOf(foods: Food[]): Index {
  let ix = indexes.get(foods);
  if (!ix) {
    const exact = new Map<string, Food>();
    const names: Index["names"] = [];
    for (const f of foods) {
      for (const k of [f.n, ...f.a]) {
        if (!exact.has(k)) exact.set(k, f);
        names.push({ key: k, food: f });
      }
    }
    names.sort((a, b) => b.key.length - a.key.length); // longest name wins: "olive oil" before "oil"
    ix = { exact, names };
    indexes.set(foods, ix);
  }
  return ix;
}

const wordsRe = (k: string) => new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}(es|s)?([^a-z]|$)`);
const reCache = new Map<string, RegExp>();

/** The food a line is about, e.g. "200 g paneer, cubed" → paneer. */
export function matchFood(line: string, foods: Food[]): Food | null {
  const ix = indexOf(foods);
  const canon = canonicalise(line);
  // The most specific name in the line wins ("crushed tomatoes" over "tomato", "cooked rice" over "rice").
  const text = ` ${line.toLowerCase().replace(/\(.*?\)/g, " ").split(/[,;]/)[0]} | ${canon} `;
  for (const { key, food } of ix.names) {
    let re = reCache.get(key);
    if (!re) reCache.set(key, (re = wordsRe(key)));
    if (re.test(text)) return food;
  }
  return ix.exact.get(canon) ?? null;
}

const FRACTIONS: Record<string, number> = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875, "⅕": 0.2 };
// Longest forms first: "1 1/2", "1/2", "1½" / "1 ½", then plain numbers; words like "a" or "half".
const NUM = String.raw`\d+\s+\d+\/\d+|\d+\/\d+|\d*\s*[¼½¾⅓⅔⅛⅜⅝⅞⅕]|\d+(?:\.\d+)?|(?:an?|one|two|three|four|half)(?=\s)`;
const WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, half: 0.5 };
const AMOUNT = new RegExp(String.raw`^\s*(?:about|approx\.?|~)?\s*(${NUM})(?:\s*(?:-|–|to)\s*(${NUM}))?\s*`, "i");

function toNumber(s: string): number | null {
  s = s.trim().toLowerCase();
  if (s in WORDS) return WORDS[s];
  const uni = s.match(/^(\d*)\s*([¼½¾⅓⅔⅛⅜⅝⅞⅕])$/);
  if (uni) return (uni[1] ? +uni[1] : 0) + FRACTIONS[uni[2]];
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return +mixed[1] + +mixed[2] / +mixed[3];
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return +frac[2] ? +frac[1] / +frac[2] : null;
  return /^\d+(\.\d+)?$/.test(s) ? +s : null;
}

// Measures in the order they're looked for after the number.
const UNITS: [RegExp, string][] = [
  [/^(kg|kgs|kilograms?|kilos?)\b/i, "kg"],
  [/^(mg)\b/i, "mg"],
  [/^(g|gm|gms|grams?|gr)\b/i, "g"],
  [/^(ml|millilitres?|milliliters?)\b/i, "ml"],
  [/^(l|litres?|liters?|ltr)\b/i, "l"],
  [/^(oz|ounces?)\b/i, "oz"],
  [/^(lbs?|pounds?)\b/i, "lb"],
  [/^(cups?|c)\b/i, "cup"],
  [/^(tbsps?|tbs|tbl|tablespoons?|T)\b/, "tbsp"],
  [/^(tsps?|teaspoons?|t)\b/, "tsp"],
  [/^(pinch(es)?)\b/i, "pinch"],
  [/^(handfuls?)\b/i, "handful"],
  [/^(cloves?)\b/i, "clove"],
  [/^(bunch(es)?)\b/i, "bunch"],
  [/^(sprigs?)\b/i, "sprig"],
  [/^(inch(es)?|")/i, "inch"],
  [/^(cans?|tins?)\b/i, "can"],
  [/^(slices?)\b/i, "slice"],
  [/^(sticks?)\b/i, "stick"],
  [/^(packets?|packs?|sachets?)\b/i, "packet"],
  [/^(sheets?)\b/i, "sheet"],
  [/^(cubes?)\b/i, "cube"],
  [/^(large|big)\b/i, "large"],
  [/^(small)\b/i, "small"],
  [/^(medium|pieces?|pcs?|nos?|whole)\b/i, "piece"],
];

/** Grams of the food in one line, or null if it can't be worked out. */
export function gramsIn(line: string, food: Food): number | null {
  const text = line.replace(/^[\s•\-–*]+/, "");
  // "1 can (400 g) tomatoes": the weight in brackets is the most reliable.
  const inBrackets = text.match(/\((\d+(?:\.\d+)?)\s*(g|gm|grams?|ml)\)/i);
  const m = text.match(AMOUNT);
  if (!m) return null;
  const a = toNumber(m[1]);
  const b = m[2] ? toNumber(m[2]) : null;
  if (a == null) return null;
  const qty = b != null ? (a + b) / 2 : a; // "2-3 green chillies" → 2.5
  let rest = text.slice(m[0].length).replace(/^x\s+/i, "");
  // "a handful of", "half a cup"
  rest = rest.replace(/^a\s+(?=cup|tbsp|tsp|tablespoon|teaspoon)/i, "");
  let unit = "piece";
  for (const [re, u] of UNITS) {
    const um = rest.match(re);
    if (um) { unit = u; rest = rest.slice(um[0].length); break; }
  }
  if (unit === "piece") {
    // "6 garlic cloves", "8 curry leaf sprigs": the measure can come after the name.
    const later = rest.match(/\b(cloves?|sprigs?|bunch(es)?|inch(es)?|slices?|sticks?|sheets?|cans?|tins?)\b/i);
    if (later) unit = later[1].toLowerCase().replace(/(es|s)$/, "").replace(/^tin$/, "can");
  }
  if (inBrackets && (unit === "can" || unit === "packet" || unit === "piece")) return qty * +inBrackets[1];
  const g = food.g;
  const density = g.cup ? g.cup / 240 : 1; // grams per ml
  switch (unit) {
    case "kg": return qty * 1000;
    case "mg": return qty / 1000;
    case "g": return qty;
    case "ml": return qty * density;
    case "l": return qty * 1000 * density;
    case "oz": return qty * 28.35;
    case "lb": return qty * 453.6;
    case "cup": return qty * (g.cup ?? 240 * density);
    case "tbsp": return qty * (g.tbsp ?? (g.cup ? g.cup / 16 : 15 * density));
    case "tsp": return qty * (g.tsp ?? (g.tbsp ? g.tbsp / 3 : g.cup ? g.cup / 48 : 5 * density));
    case "pinch": return qty * (g.pinch ?? 0.3);
    case "handful": return qty * (g.handful ?? 30);
    case "clove": return qty * (g.clove ?? 3);
    case "bunch": return qty * (g.bunch ?? 100);
    case "sprig": return qty * (g.sprig ?? 1);
    case "inch": return qty * (g.inch ?? 5);
    case "can": return qty * (g.can ?? 400);
    case "slice": return g.slice ? qty * g.slice : null;
    case "stick": return g.stick ? qty * g.stick : qty * 113; // a stick of butter
    case "packet": return g.packet ? qty * g.packet : null;
    case "sheet": return g.sheet ? qty * g.sheet : null;
    case "cube": return g.cube ? qty * g.cube : null;
    case "large": return qty * (g.large ?? (g.piece ? g.piece * 1.3 : NaN)) || null;
    case "small": return qty * (g.small ?? (g.piece ? g.piece * 0.7 : NaN)) || null;
    default: return g.piece ? qty * g.piece : null;
  }
}

export type Counted = { line: string; food: Food; grams: number; kcal: number };
export type Calculation = {
  total: [number, number, number, number, number];
  counted: Counted[];
  /** Lines that matter but couldn't be counted. */
  skipped: string[];
  /** Lines that can be ignored (salt, water, a pinch of spice). */
  ignored: string[];
};

/** Lines with no amount that barely matter, like "salt to taste". */
const TRIVIAL = new Set(["salt", "water", "black pepper", "baking soda", "asafoetida", "curry leaves", "coriander", "mint", "bay leaf", "cardamom", "cloves", "cinnamon", "dried red chilli", "chilli flakes", "oregano", "basil", "parsley", "turmeric", "chilli powder", "garam masala", "cumin seeds", "mustard seeds", "fenugreek seeds", "kasuri methi", "vanilla extract", "lemon", "lime"]);

/** Spices used by the pinch or teaspoon that aren't in the food table; too small to matter. */
const SMALL_SPICES = /\b(amchur|aamchur|mango powder|chaat masala|ajwain|carom|saffron|kesar|nutmeg|mace|star anise|fennel|saunf|kalonji|nigella|panch phoron|sambar powder|rasam powder|msg|food colou?r|essence|rose water|kewra)\b/i;

export function calculate(lines: string[], foods: Food[]): Calculation {
  const total: Calculation["total"] = [0, 0, 0, 0, 0];
  const counted: Counted[] = [];
  const skipped: string[] = [];
  const ignored: string[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const food = matchFood(line, foods);
    const grams = food ? gramsIn(line, food) : null;
    if (food && grams != null && grams >= 0 && grams < 20000) {
      const f = grams / 100;
      food.v.forEach((v, i) => (total[i] += v * f));
      counted.push({ line, food, grams, kcal: food.v[0] * f });
    } else if ((food && TRIVIAL.has(food.n)) || (!food && SMALL_SPICES.test(line))) ignored.push(line);
    else skipped.push(line);
  }
  return { total, counted, skipped, ignored };
}

/** Changes whenever what nutrition depends on changes (ingredients, servings). */
export function nutritionKey(r: Pick<Recipe, "ingredients" | "servings">): string {
  const s = `${r.servings ?? ""}|${r.ingredients.map((i) => i.original).join("\n")}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const NUTRITION_TAGS = ["High protein", "High fibre", "Low carb", "Low calorie"];
export function nutritionTags(n: Nutrition): string[] {
  const T = NUTRITION_THRESHOLDS, out: string[] = [];
  if (n.protein != null && n.protein >= T.highProteinGrams) out.push("High protein");
  if (n.fibre != null && n.fibre >= T.highFibreGrams) out.push("High fibre");
  if (n.carbs != null && n.carbs <= T.lowCarbGrams) out.push("Low carb");
  if (n.calories != null && n.calories <= T.lowCalorieKcal) out.push("Low calorie");
  return out;
}

/** Enough of the recipe counted to trust the total: 60% of the lines that matter, and at least 2. */
export const goodEnough = (c: Calculation) => c.counted.length >= 2 && c.counted.length / (c.counted.length + c.skipped.length) >= 0.6;

/**
 * What to save on a recipe after its ingredients or servings change: calculated
 * numbers when enough can be counted, otherwise the AI estimate stays. Nutrition
 * you typed in yourself is never replaced. Returns null when nothing changes.
 */
export async function recalculate(r: Recipe): Promise<Partial<Recipe> | null> {
  const key = nutritionKey(r);
  if (r.nutritionFor === key || r.nutritionSource === "manual") return null;
  const foods = await loadFoods();
  const c = calculate(r.ingredients.map((i) => i.original), foods);
  if (!r.servings || !goodEnough(c)) {
    // Can't calculate: keep what's there (an AI estimate), and remember we tried.
    return { nutritionFor: key, nutritionSource: r.nutrition ? r.nutritionSource ?? "ai" : null, nutritionCount: { counted: c.counted.length, of: c.counted.length + c.skipped.length } };
  }
  const per = c.total.map((v) => v / r.servings!);
  const nutrition: Nutrition = { calories: Math.round(per[0]), protein: Math.round(per[1]), fat: Math.round(per[2]), carbs: Math.round(per[3]), fibre: Math.round(per[4]) };
  const tags = [...r.tags.filter((t) => !NUTRITION_TAGS.includes(t)), ...nutritionTags(nutrition)];
  return { nutrition, nutritionSource: "calculated", nutritionFor: key, nutritionCount: { counted: c.counted.length, of: c.counted.length + c.skipped.length }, tags };
}
