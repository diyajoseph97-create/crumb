// Ingredient standardisation.
// Maps common alternative names to one canonical name, so searching
// "coriander" also finds a recipe that says "dhania" or "cilantro".
// Add to this list any time — left side = what people write, right side = canonical.

const SYNONYMS: Record<string, string> = {
  cilantro: "coriander",
  dhania: "coriander",
  "coriander leaves": "coriander",
  "fresh coriander": "coriander",
  "coriander leaf": "coriander",
  curd: "yogurt",
  dahi: "yogurt",
  yoghurt: "yogurt",
  "greek yogurt": "yogurt",
  "hung curd": "yogurt",
  maida: "all-purpose flour",
  "plain flour": "all-purpose flour",
  "all purpose flour": "all-purpose flour",
  "refined flour": "all-purpose flour",
  atta: "whole wheat flour",
  "wheat flour": "whole wheat flour",
  besan: "gram flour",
  "chickpea flour": "gram flour",
  capsicum: "bell pepper",
  "green capsicum": "bell pepper",
  "red capsicum": "bell pepper",
  "yellow capsicum": "bell pepper",
  "red bell pepper": "bell pepper",
  "bell peppers": "bell pepper",
  palak: "spinach",
  "baby spinach": "spinach",
  "cottage cheese": "paneer",
  aloo: "potato",
  potatoes: "potato",
  pyaz: "onion",
  onions: "onion",
  "red onion": "onion",
  tamatar: "tomato",
  tomatoes: "tomato",
  "cherry tomatoes": "tomato",
  adrak: "ginger",
  lehsun: "garlic",
  "garlic cloves": "garlic",
  "garlic clove": "garlic",
  haldi: "turmeric",
  "turmeric powder": "turmeric",
  jeera: "cumin",
  "cumin seeds": "cumin",
  "cumin powder": "cumin",
  rai: "mustard seeds",
  "mustard seed": "mustard seeds",
  methi: "fenugreek",
  "kasuri methi": "dried fenugreek leaves",
  hing: "asafoetida",
  ghee: "ghee",
  "clarified butter": "ghee",
  chana: "chickpeas",
  "kabuli chana": "chickpeas",
  chickpea: "chickpeas",
  garbanzo: "chickpeas",
  "garbanzo beans": "chickpeas",
  "green chillies": "green chilli",
  "green chilies": "green chilli",
  "green chili": "green chilli",
  "red chilli powder": "chilli powder",
  "red chili powder": "chilli powder",
  "kashmiri chilli powder": "chilli powder",
  "chili powder": "chilli powder",
  "curry leaf": "curry leaves",
  "kadi patta": "curry leaves",
  mushrooms: "mushroom",
  "button mushrooms": "mushroom",
  eggs: "egg",
  "spring onions": "spring onion",
  scallion: "spring onion",
  scallions: "spring onion",
  "green onion": "spring onion",
  "soy sauce": "soy sauce",
  "light soy sauce": "soy sauce",
  "dark soy sauce": "soy sauce",
  "coconut milk": "coconut milk",
  "grated coconut": "coconut",
  "desiccated coconut": "coconut",
  "basmati rice": "rice",
  "cooked rice": "rice",
  "toor dal": "pigeon peas",
  "arhar dal": "pigeon peas",
  "chicken breast": "chicken",
  "chicken thighs": "chicken",
  "boneless chicken": "chicken",
  "olive oil": "olive oil",
  "extra virgin olive oil": "olive oil",
  "lemon juice": "lemon",
  lemons: "lemon",
  "lime juice": "lime",
  limes: "lime",
  "parmesan cheese": "parmesan",
  "parmigiano reggiano": "parmesan",
  aubergine: "eggplant",
  brinjal: "eggplant",
  baingan: "eggplant",
  courgette: "zucchini",
  "ladies finger": "okra",
  bhindi: "okra",
};

const DESCRIPTORS =
  /\b(fresh|freshly|finely|roughly|thinly|chopped|diced|minced|sliced|grated|crushed|ground|cubed|peeled|large|medium|small|ripe|boiled|cooked|softened|melted|chilled|cold|warm|hot|lukewarm|thick|thin|toasted|roasted|optional|to taste|as needed|as required|for garnish|organic|heaped|level|packed|about|approx\.?)\b/gi;

export const UNITS =
  /^(cups?|c|tbsp|tbs|tablespoons?|tsp|teaspoons?|g|grams?|gm|gms|kg|kilograms?|ml|millilitres?|milliliters?|l|litres?|liters?|oz|ounces?|lbs?|pounds?|pinch(es)?|handful(s)?|cloves?|cans?|tins?|sprigs?|bunch(es)?|pieces?|pcs|inch(es)?|nos?|slices?|sticks?|stalks?|dash(es)?|packets?)\b\.?/i;

/** Turn free text like "1½ cups finely chopped palak" into "spinach". */
export function canonicalise(original: string): string {
  let s = original.toLowerCase();
  s = s.replace(/\(.*?\)/g, " "); // drop "(optional)" etc.
  s = s.split(/[,;]|\bor\b/)[0]; // keep the part before a comma / "or"
  s = s.replace(/^[\s\d¼½¾⅓⅔⅛.\/\-–~]+/, ""); // leading numbers
  s = s.replace(UNITS, "");
  s = s.replace(/^\s*of\s+/, "");
  s = s.replace(DESCRIPTORS, " ");
  s = s.replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();
  return normaliseName(s);
}

/** Map a name through the synonym list (also used on AI-provided canonical names). */
export function normaliseName(name: string): string {
  const s = name.toLowerCase().trim().replace(/\s+/g, " ");
  if (!s) return "";
  if (SYNONYMS[s]) return SYNONYMS[s];
  // try singular form
  if (s.endsWith("es") && SYNONYMS[s.slice(0, -2)]) return SYNONYMS[s.slice(0, -2)];
  if (s.endsWith("s") && SYNONYMS[s.slice(0, -1)]) return SYNONYMS[s.slice(0, -1)];
  return s;
}

/** Display form: "all-purpose flour" -> "All-purpose flour". */
export function displayName(canonical: string): string {
  return canonical ? canonical[0].toUpperCase() + canonical.slice(1) : canonical;
}
