// Fixed category lists. The AI may only choose from these.

export const CUISINES = [
  "Indian",
  "North Indian",
  "South Indian",
  "Italian",
  "Chinese",
  "Japanese",
  "Korean",
  "Thai",
  "Mexican",
  "Mediterranean",
  "American",
  "Middle Eastern",
  "Other",
] as const;

export const MEALS = [
  "Breakfast",
  "Brunch",
  "Lunch",
  "Dinner",
  "Snacks",
  "Appetisers",
  "Desserts",
  "Drinks",
  "Sides",
] as const;

export const TAGS = [
  "High protein",
  "High fibre",
  "Low carb",
  "Low calorie",
  "Gluten-free",
  "Dairy-free",
  "Egg-free",
  "Vegetarian",
  "Vegan",
] as const;

/** Tags that relate to allergies/intolerances — always shown as "suggested" until confirmed. */
export const SENSITIVE_TAGS = ["Gluten-free", "Dairy-free", "Egg-free"];

export const TIME_RANGES = [
  { id: "u15", label: "Under 15 min", test: (t: number) => t < 15 },
  { id: "15-30", label: "15–30 min", test: (t: number) => t >= 15 && t <= 30 },
  { id: "30-45", label: "30–45 min", test: (t: number) => t > 30 && t <= 45 },
  { id: "45-60", label: "45–60 min", test: (t: number) => t > 45 && t <= 60 },
  { id: "o60", label: "Over 60 min", test: (t: number) => t > 60 },
] as const;

/** Thresholds used when the AI suggests nutrition tags (per serving). */
export const NUTRITION_THRESHOLDS = {
  highProteinGrams: 20,
  highFibreGrams: 6,
  lowCarbGrams: 20,
  lowCalorieKcal: 400,
};

/** Each meal type gets a brand colour + doodle for placeholders and shortcuts. */
