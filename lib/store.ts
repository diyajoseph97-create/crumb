"use client";
// The interface only talks to a "Store". There are two:
// - RemoteStore: the real one, talks to Crumb's server (database, AI import).
// - DemoStore: used by the shareable demo; keeps everything in this browser.

import type { ImportResult, Recipe, RecipeDraft } from "./types";
import { SEED_RECIPES } from "./seed";
import { instagramShortcode, newId, canonicalInstagramUrl, emptyDraft } from "./recipe-utils";

export type ScreenshotRequest = {
  images: string[]; // data URLs (already resized)
  text?: string; // optional pasted caption
  sourceUrl?: string;
  recipeId?: string; // when filling in an existing incomplete recipe
};

export interface Store {
  mode: "remote" | "demo";
  list(): Promise<Recipe[]>;
  create(draft: RecipeDraft): Promise<Recipe>;
  update(id: string, patch: Partial<RecipeDraft>): Promise<Recipe>;
  remove(id: string): Promise<void>;
  uploadImage(dataUrl: string): Promise<string>;
  importUrl(url: string): Promise<ImportResult>;
  extract(req: ScreenshotRequest): Promise<ImportResult>;
}

// ---------- Real server ----------
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 401) {
    window.location.href = "/unlock";
    throw new Error("Please unlock Crumb first.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `Something went wrong (${res.status})`);
  return body as T;
}

export const RemoteStore: Store = {
  mode: "remote",
  list: () => call<{ recipes: Recipe[] }>("/api/recipes").then((b) => b.recipes),
  create: (draft) =>
    call<{ recipe: Recipe }>("/api/recipes", { method: "POST", body: JSON.stringify(draft) }).then((b) => b.recipe),
  update: (id, patch) =>
    call<{ recipe: Recipe }>(`/api/recipes/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).then(
      (b) => b.recipe
    ),
  remove: (id) => call(`/api/recipes/${id}`, { method: "DELETE" }).then(() => undefined),
  uploadImage: (dataUrl) =>
    call<{ url: string }>("/api/upload", { method: "POST", body: JSON.stringify({ dataUrl }) }).then((b) => b.url),
  importUrl: (url) => call<ImportResult>("/api/import", { method: "POST", body: JSON.stringify({ url }) }),
  extract: (req) => call<ImportResult>("/api/extract", { method: "POST", body: JSON.stringify(req) }),
};

// ---------- Demo (browser only) ----------
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
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    return dataUrl; // demo keeps the image in the browser
  },
  async importUrl(url) {
    const code = instagramShortcode(url);
    if (!code) return { status: "error", message: "That doesn't look like an Instagram post or Reel link." };
    await wait(2400);
    const existing = load().find((r) => r.sourceShortcode === code);
    if (existing) return { status: "duplicate", recipe: structuredClone(existing) };
    const recipe = await DemoStore.create({
      ...emptyDraft(),
      name: "Recipe from Instagram",
      sourceUrl: canonicalInstagramUrl(code),
      sourceShortcode: code,
      importNotes:
        "This is the demo, so Crumb didn't really read the Reel. In the live app, the caption and thumbnail are fetched and structured by AI. Add the details by hand or with screenshots.",
    });
    return { status: "saved", recipe };
  },
  async extract() {
    await wait(800);
    return {
      status: "error",
      message: "Reading screenshots needs the live app (the AI runs on Crumb's server). In this demo you can type the recipe in instead.",
    };
  },
};
