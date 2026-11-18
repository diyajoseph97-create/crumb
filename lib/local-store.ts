// Recipes are saved in this browser (IndexedDB), photos included.
// Nothing is sent anywhere except the video/screenshots you ask Gemini to read.
// Use Settings → Download a backup now and then; clearing browser data deletes it.
import type { Recipe, RecipeDraft } from "./types";
import type { Store } from "./store";
import { newId } from "./recipe-utils";
import { normaliseRecipe } from "./validate";

const DB_NAME = "crumb";
const STORE = "recipes";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error("This browser couldn't open Crumb's storage. Private/incognito windows may block it."));
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;
const db = () => (dbPromise ??= openDb());

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        t.oncomplete = () => resolve(req.result);
        t.onerror = () => reject(t.error ?? new Error("Couldn't save. The browser's storage may be full."));
      })
  );
}

/** Ask the browser to keep Crumb's data even when space runs low. */
export function requestPersistence() {
  navigator.storage?.persist?.().catch(() => {});
}

export const LocalStore: Store = {
  mode: "remote",
  async list() {
    const all = await tx<Recipe[]>("readonly", (s) => s.getAll() as IDBRequest<Recipe[]>);
    return all.map(normaliseRecipe);
  },
  async create(draft: RecipeDraft) {
    const now = new Date().toISOString();
    const r: Recipe = { ...draft, id: newId(), createdAt: now, updatedAt: now };
    await tx("readwrite", (s) => s.put(r));
    return r;
  },
  async update(id: string, patch: Partial<RecipeDraft>) {
    const current = await tx<Recipe | undefined>("readonly", (s) => s.get(id) as IDBRequest<Recipe | undefined>);
    if (!current) throw new Error("Recipe not found");
    const r: Recipe = { ...current, ...patch, id, updatedAt: new Date().toISOString() };
    await tx("readwrite", (s) => s.put(r));
    return r;
  },
  async remove(id: string) {
    await tx("readwrite", (s) => s.delete(id));
  },
  async uploadImage(dataUrl: string) {
    return dataUrl; // photos are stored inside the recipe
  },
};

// ---------- Backup ----------
export async function downloadBackup() {
  const recipes = await LocalStore.list();
  const blob = new Blob([JSON.stringify({ app: "crumb", version: 1, exportedAt: new Date().toISOString(), count: recipes.length, recipes })], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `crumb-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return recipes.length;
}

/** Adds recipes from a backup file. Recipes already here (same id) are replaced by the backup's copy. */
export async function restoreBackup(file: File): Promise<number> {
  let data: any;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("That file isn't a Crumb backup.");
  }
  const list = Array.isArray(data) ? data : data?.recipes;
  if (!Array.isArray(list)) throw new Error("That file isn't a Crumb backup.");
  const recipes = list.filter((r: any) => r && typeof r.id === "string").map(normaliseRecipe);
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const t = d.transaction(STORE, "readwrite");
    const s = t.objectStore(STORE);
    recipes.forEach((r) => s.put(r));
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error ?? new Error("Couldn't restore. The browser's storage may be full."));
  });
  return recipes.length;
}

// ---------- Gemini key (this browser only) ----------
const KEY = "crumb-gemini-key";
export const getGeminiKey = () => {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
};
export const setGeminiKey = (k: string) => {
  try {
    if (k) localStorage.setItem(KEY, k);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};
