// The interface talks to a "Store" (see lib/local-store.ts: recipes saved in this browser).
import type { Recipe, RecipeDraft } from "./types";

export interface Store {
  mode: "remote" | "demo";
  list(): Promise<Recipe[]>;
  create(draft: RecipeDraft): Promise<Recipe>;
  update(id: string, patch: Partial<RecipeDraft>): Promise<Recipe>;
  remove(id: string): Promise<void>;
  /** Saves a photo (data URL) and returns the value to put in recipe.imageUrl. */
  uploadImage(dataUrl: string): Promise<string>;
  /** Turns a stored imageUrl into something an <img> can show. */
  resolveImage?(url: string): Promise<string>;
}

