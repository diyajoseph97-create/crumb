// Stores recipes in a PRIVATE GitHub repository (e.g. "crumb-data"):
//   recipes/<id>.json   one file per recipe
//   images/<uuid>.jpg   photos
// Each device connects once with a GitHub token that can only read/write
// that one repo. The token is kept in this browser only, never in the code.
import type { Recipe, RecipeDraft } from "./types";
import type { Store } from "./store";
import { newId } from "./recipe-utils";
import { normaliseRecipe } from "./validate";

export type Settings = { token: string; owner: string; repo: string; geminiKey: string };
const SETTINGS_KEY = "crumb-settings-v1";

export function loadSettings(): Settings | null {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null");
    return s?.token && s?.owner && s?.repo ? s : null;
  } catch {
    return null;
  }
}
export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}
export function clearSettings() {
  localStorage.removeItem(SETTINGS_KEY);
}

const API = "https://api.github.com";

function headers(token: string, extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...extra,
  };
}

function friendly(status: number, fallback: string) {
  if (status === 401) return "GitHub didn't accept the access token. It may have expired. Reconnect in Settings.";
  if (status === 403) return "The access token doesn't have permission for the recipes repo. Check it has Contents: Read and write.";
  if (status === 404) return "Couldn't find the recipes repo. Check the name in Settings.";
  return fallback;
}

/** UTF-8 safe base64 for text. */
function textToBase64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Checks a token + repo before saving them. Returns the error message, or null if fine. */
export async function verifySettings(s: Settings): Promise<string | null> {
  try {
    const res = await fetch(`${API}/repos/${s.owner}/${s.repo}`, { headers: headers(s.token) });
    if (!res.ok) return friendly(res.status, `GitHub said: ${res.status}`);
    const repo = await res.json();
    if (repo.private === false) return `“${s.owner}/${s.repo}” is public. Use a private repo so your recipes stay private.`;
    if (repo.permissions && repo.permissions.push === false) return "This token can read the repo but not save to it. Give it Contents: Read and write.";
    return null;
  } catch {
    return "Couldn't reach GitHub. Check your internet connection.";
  }
}

export function createGitHubStore(s: Settings): Store & { resolveImage(url: string): Promise<string> } {
  const base = `${API}/repos/${s.owner}/${s.repo}/contents`;
  const shas = new Map<string, string>(); // path -> current file version
  const cache = new Map<string, Recipe>();

  async function putFile(path: string, base64: string, message: string, sha?: string) {
    const res = await fetch(`${base}/${path}`, {
      method: "PUT",
      headers: headers(s.token, { "Content-Type": "application/json" }),
      body: JSON.stringify({ message, content: base64, ...(sha ? { sha } : {}) }),
    });
    if (!res.ok) {
      const err: any = new Error(friendly(res.status, `Couldn't save to GitHub (${res.status}).`));
      err.status = res.status;
      throw err;
    }
    const body = await res.json();
    shas.set(path, body.content.sha);
  }

  async function getJson(path: string): Promise<{ data: any; sha: string } | null> {
    const res = await fetch(`${base}/${path}`, { headers: headers(s.token) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(friendly(res.status, `Couldn't read from GitHub (${res.status}).`));
    const body = await res.json();
    const text = new TextDecoder().decode(Uint8Array.from(atob(body.content.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
    return { data: JSON.parse(text), sha: body.sha };
  }

  async function writeRecipe(r: Recipe, message: string) {
    const path = `recipes/${r.id}.json`;
    const content = textToBase64(JSON.stringify(r, null, 2));
    try {
      await putFile(path, content, message, shas.get(path));
    } catch (e: any) {
      // Changed on another device since we loaded it: get the latest version number and try once more.
      if (e.status === 409 || e.status === 422) {
        const latest = await getJson(path);
        await putFile(path, content, message, latest?.sha);
      } else throw e;
    }
    cache.set(r.id, r);
  }

  const store = {
    mode: "remote" as const,

    async list(): Promise<Recipe[]> {
      // One request loads every recipe file at once.
      const res = await fetch(`${API}/graphql`, {
        method: "POST",
        headers: headers(s.token, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          query: `query($o:String!,$r:String!){repository(owner:$o,name:$r){object(expression:"HEAD:recipes"){... on Tree{entries{name oid object{... on Blob{text}}}}}}}`,
          variables: { o: s.owner, r: s.repo },
        }),
      });
      if (!res.ok) throw new Error(friendly(res.status, `Couldn't load recipes from GitHub (${res.status}).`));
      const body = await res.json();
      if (body.errors?.length) throw new Error(body.errors[0].message);
      const entries: any[] = body.data?.repository?.object?.entries ?? [];
      const recipes: Recipe[] = [];
      for (const e of entries) {
        if (!e.name.endsWith(".json") || !e.object?.text) continue;
        try {
          const r = normaliseRecipe(JSON.parse(e.object.text));
          shas.set(`recipes/${e.name}`, e.oid);
          cache.set(r.id, r);
          recipes.push(r);
        } catch {
          /* skip a damaged file rather than failing the whole library */
        }
      }
      return recipes;
    },

    async create(draft: RecipeDraft): Promise<Recipe> {
      const now = new Date().toISOString();
      const r: Recipe = { ...draft, id: newId(), createdAt: now, updatedAt: now };
      await writeRecipe(r, `Add ${r.name}`);
      return r;
    },

    async update(id: string, patch: Partial<RecipeDraft>): Promise<Recipe> {
      let current = cache.get(id);
      if (!current) {
        const got = await getJson(`recipes/${id}.json`);
        if (!got) throw new Error("Recipe not found");
        current = normaliseRecipe(got.data);
        shas.set(`recipes/${id}.json`, got.sha);
      }
      const r: Recipe = { ...current, ...patch, id, updatedAt: new Date().toISOString() };
      await writeRecipe(r, `Update ${r.name}`);
      return r;
    },

    async remove(id: string) {
      const path = `recipes/${id}.json`;
      let sha = shas.get(path);
      if (!sha) sha = (await getJson(path))?.sha;
      if (!sha) return;
      const res = await fetch(`${base}/${path}`, {
        method: "DELETE",
        headers: headers(s.token, { "Content-Type": "application/json" }),
        body: JSON.stringify({ message: `Delete ${cache.get(id)?.name ?? id}`, sha }),
      });
      if (!res.ok && res.status !== 404) throw new Error(friendly(res.status, `Couldn't delete (${res.status}).`));
      // Remove its photo too (best effort).
      const img = cache.get(id)?.imageUrl;
      if (img?.startsWith("gh:")) {
        const p = img.slice(3);
        const meta = await fetch(`${base}/${p}`, { headers: headers(s.token) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (meta?.sha) {
          await fetch(`${base}/${p}`, {
            method: "DELETE",
            headers: headers(s.token, { "Content-Type": "application/json" }),
            body: JSON.stringify({ message: "Delete photo", sha: meta.sha }),
          }).catch(() => {});
        }
      }
      shas.delete(path);
      cache.delete(id);
    },

    async uploadImage(dataUrl: string): Promise<string> {
      const m = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,(.*)$/);
      if (!m) throw new Error("Please use a JPG, PNG or WebP image.");
      const ext = m[1] === "jpeg" ? "jpg" : m[1];
      const path = `images/${newId()}.${ext}`;
      await putFile(path, m[2], "Add photo");
      return `gh:${path}`;
    },

    /** Photos live in a private repo, so they're fetched with the token and kept in a local cache. */
    async resolveImage(url: string): Promise<string> {
      if (!url.startsWith("gh:")) return url;
      const path = url.slice(3);
      const key = `https://crumb.cache/${s.owner}/${s.repo}/${path}`;
      let blob: Blob | null = null;
      try {
        const c = await caches.open("crumb-images");
        const hit = await c.match(key);
        if (hit) blob = await hit.blob();
        else {
          const res = await fetch(`${base}/${path}`, { headers: headers(s.token, { Accept: "application/vnd.github.raw+json" }) });
          if (!res.ok) throw new Error(String(res.status));
          blob = await res.blob();
          await c.put(key, new Response(blob, { headers: { "Content-Type": blob.type || "image/jpeg" } }));
        }
      } catch {
        const res = await fetch(`${base}/${path}`, { headers: headers(s.token, { Accept: "application/vnd.github.raw+json" }) });
        if (!res.ok) throw new Error("Photo not found");
        blob = await res.blob();
      }
      return URL.createObjectURL(blob!);
    },
  };
  return store;
}
