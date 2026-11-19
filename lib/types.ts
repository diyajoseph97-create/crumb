// The shape of one recipe. This same object is stored in the database
// (as JSON) and used everywhere in the interface.

export type Ingredient = {
  id: string;
  /** Exactly as extracted or typed, e.g. "200 g paneer, cubed". Never rewritten. */
  original: string;
  /** Standardised name used for search & filters, e.g. "paneer". */
  canonical: string;
};

export type Nutrition = {
  /** All values are PER SERVING and are AI estimates. null = not available. */
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fibre: number | null;
};

export type Recipe = {
  id: string;
  name: string;
  imageUrl: string | null;
  ingredients: Ingredient[];
  steps: string[];
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  /** true when prep/cook times were estimated by AI because the Reel didn't state them. */
  timesEstimated?: boolean;
  /** true when the serving count was estimated by AI because the Reel didn't state it. */
  servingsEstimated?: boolean;
  sourceUrl: string | null;
  /** Instagram shortcode used for duplicate detection, e.g. "C8xYz12AbCd". */
  sourceShortcode: string | null;
  cuisines: string[];
  meals: string[];
  /** Confirmed dietary / nutrition tags. */
  tags: string[];
  /** AI-suggested tags not yet confirmed by you (shown with a "suggested" style). */
  suggestedTags: string[];
  nutrition: Nutrition | null;
  /** Where the nutrition came from: worked out from the ingredients, an AI estimate, or typed in by you. */
  nutritionSource?: "calculated" | "ai" | "manual" | null;
  /** Which ingredients/servings the nutrition was worked out for (so it's redone when they change). */
  nutritionFor?: string | null;
  /** How many ingredient lines could be counted, of the ones that matter. */
  nutritionCount?: { counted: number; of: number } | null;
  /** Suggestions for a healthier version (shown in the notes card; the recipe itself is never changed). */
  healthTips?: string[] | null;
  /** Who made the original: Instagram handle or YouTube channel, e.g. "@kitchenstories". */
  creator?: string | null;
  /** Your own notes ("used half the chilli"). Not shown on shared links. */
  myNotes?: string | null;
  /** Your own groups, e.g. "Weeknight", "Party". */
  collections?: string[];
  /** How many times you've made it, when you last did, and how it went (1–5). */
  cookedCount?: number;
  lastCookedAt?: string | null;
  rating?: number | null;
  /** The raw caption text we found, kept for reference. */
  originalCaption: string | null;
  /** What was said and shown in the video (used when the recipe wasn't in the caption). */
  sourceTranscript?: string | null;
  /** Notes from the importer, e.g. "Caption says full recipe is in the comments." */
  importNotes: string | null;
  favourite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecipeDraft = Omit<Recipe, "id" | "createdAt" | "updatedAt">;

export type ImportResult =
  | { status: "saved"; recipe: Recipe }
  | { status: "duplicate"; recipe: Recipe }
  | { status: "later"; recipe: Recipe }
  | { status: "error"; message: string };
