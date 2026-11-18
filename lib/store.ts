// The interface only talks to a "Store":
// - GitHub store (lib/github.ts): the real one, saves to your private GitHub repo.
// - DemoStore: sample recipes kept in this browser only.
import type { Recipe, RecipeDraft } from "./types";
import { SEED_RECIPES } from "./seed";
import { newId } from "./recipe-utils";

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

const KEY = "crumb-demo-v1";
let memory: Recipe[] | null = null;

function load(): Recipe[] {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    memory = raw ? JSON.parse(raw) : structuredClone(SEED_RECIPES);
  } catch {
    memory = structuredClone(SEED_RECIPES);
  }
  return memory!;
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* storage may be unavailable; keep working in memory */
  }
}

export const DemoStore: Store = {
  mode: "demo",
  async list() {
    return structuredClone(load());
  },
  async create(draft) {
    const now = new Date().toISOString();
    const r: Recipe = { ...draft, id: newId(), createdAt: now, updatedAt: now };
    load().unshift(r);
    save();
    return structuredClone(r);
  },
  async update(id, patch) {
    const list = load();
    const i = list.findIndex((r) => r.id === id);
    if (i < 0) throw new Error("Recipe not found");
    list[i] = { ...list[i], ...patch, updatedAt: new Date().toISOString() };
    save();
    return structuredClone(list[i]);
  },
  async remove(id) {
    memory = load().filter((r) => r.id !== id);
    save();
  },
  async uploadImage(dataUrl) {
    return dataUrl;
  },
};
