// Read a pasted recipe (a caption, a blog post, a note) into fields, with no AI.
// It only sorts the lines it is given: nothing is invented.

export type PastedRecipe = {
  name: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: string[];
  steps: string[];
};

const ING_HEAD = /^(ingredients?|you(?:'|’)?ll need|you will need|what you(?:'|’)?ll need|what you need|for the [a-z ]+)\s*[:\-–]?\s*$/i;
const STEP_HEAD = /^(method|instructions?|steps?|directions?|how to (?:make|cook)(?: it)?|preparation|procedure|recipe)\s*[:\-–]?\s*$/i;
const SKIP = /^(notes?|tips?|nutrition|#|follow|save this|share this|link in bio)/i;
const BULLET = /^\s*(?:[-–•*▪︎●◦○▫️✔️✅👉➡️🔸🔹]+|\d+\s*[.)]|step\s*\d+\s*[:.)-]?)\s*/i;
const AMOUNT = /^(?:\d+(?:[.,/]\d+)?|[¼½¾⅓⅔⅛]|a |an |one |two |three |half |pinch|handful|few )/i;
const UNIT = /\b(g|gm|gms|grams?|kg|ml|l|litres?|liters?|cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|lbs?|pinch|bunch(?:es)?|cloves?|cans?|sprigs?|inch)\b/i;

function minutes(text: string, word: RegExp): number | null {
  const m = text.match(new RegExp(word.source + String.raw`[^\d\n]{0,12}(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?)\b`, "i"));
  if (!m) return null;
  const n = parseFloat(m[2]);
  return Math.round(/^h/i.test(m[3]) ? n * 60 : n);
}

export function parsePastedRecipe(raw: string): PastedRecipe {
  const text = raw.replace(/\r/g, "");
  const lines = text.split("\n").map((l) => l.trim());
  const out: PastedRecipe = { name: null, servings: null, prepMinutes: null, cookMinutes: null, ingredients: [], steps: [] };

  const serves = text.match(/\b(?:serves|servings?|makes|yield)\s*[:\-]?\s*(\d+)/i) || text.match(/\b(\d+)\s*(?:servings|portions|people)\b/i);
  if (serves) out.servings = parseInt(serves[1], 10);
  out.prepMinutes = minutes(text, /\bprep(?:aration)?(?: time)?/);
  out.cookMinutes = minutes(text, /\bcook(?:ing)?(?: time)?/);

  let mode: "" | "ing" | "step" | "skip" = "";
  const loose: string[] = [];
  for (const line of lines) {
    if (!line || /^(#\S+\s*)+$/.test(line)) continue;
    const bare = line.replace(/[*_#:]+$/g, "").replace(/^[*_#]+/, "").trim();
    if (ING_HEAD.test(bare)) { mode = "ing"; continue; }
    if (STEP_HEAD.test(bare)) { mode = "step"; continue; }
    if (SKIP.test(bare) && bare.length < 40) { mode = "skip"; continue; }
    if (/^(serves|servings?|prep|cook|total|makes|yield)\b/i.test(bare) && bare.length < 60) continue;
    const item = line.replace(BULLET, "").trim();
    if (!item) continue;
    if (mode === "ing") out.ingredients.push(item);
    else if (mode === "step") out.steps.push(item);
    else if (mode === "") loose.push(line);
  }

  // The name: a short first line that isn't an ingredient or a sentence.
  const first = loose[0];
  if (first && first.length <= 70 && !AMOUNT.test(first) && !/[.!?]$/.test(first)) {
    out.name = first.replace(/^[#*\s]+|[#*\s]+$/g, "").replace(/\s*[|–-]\s*$/, "").replace(/[\s\p{Extended_Pictographic}\uFE0F]+$/u, "");
    loose.shift();
  }

  // No headings: sort the rest by shape.
  if (!out.ingredients.length && !out.steps.length) {
    for (const line of loose) {
      const item = line.replace(BULLET, "").trim();
      if (!item || /^#/.test(item)) continue;
      const looksLikeIngredient = item.length <= 70 && (AMOUNT.test(item) || UNIT.test(item)) && !/[.!?]$/.test(item);
      if (looksLikeIngredient && !out.steps.length) out.ingredients.push(item);
      else if (item.split(" ").length >= 4) out.steps.push(item);
    }
  }
  return out;
}
