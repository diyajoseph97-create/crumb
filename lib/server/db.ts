import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Recipe, RecipeDraft } from "@/lib/types";

let client: SupabaseClient | null = null;
export const IMAGE_BUCKET = "recipe-images";

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Crumb isn't connected to its database yet (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).");
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

type Row = { id: string; source_shortcode: string | null; data: RecipeDraft; created_at: string; updated_at: string };

function toRecipe(row: Row): Recipe {
  return { ...row.data, id: row.id, sourceShortcode: row.source_shortcode, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function listRecipes(): Promise<Recipe[]> {
  const { data, error } = await db().from("recipes").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Row[]).map(toRecipe);
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  const { data, error } = await db().from("recipes").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRecipe(data as Row) : null;
}

export async function findByShortcode(code: string): Promise<Recipe | null> {
  const { data, error } = await db().from("recipes").select("*").eq("source_shortcode", code).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRecipe(data as Row) : null;
}

export class DuplicateError extends Error {}

export async function insertRecipe(draft: RecipeDraft): Promise<Recipe> {
  const { sourceShortcode, ...rest } = draft;
  const { data, error } = await db()
    .from("recipes")
    .insert({ source_shortcode: sourceShortcode, data: { ...rest, sourceShortcode } })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new DuplicateError("Already saved");
    throw new Error(error.message);
  }
  return toRecipe(data as Row);
}

export async function updateRecipe(id: string, patch: Partial<RecipeDraft>): Promise<Recipe> {
  const current = await getRecipe(id);
  if (!current) throw new Error("Recipe not found");
  const { id: _i, createdAt: _c, updatedAt: _u, ...currentDraft } = current;
  const next: RecipeDraft = { ...currentDraft, ...patch };
  const { data, error } = await db()
    .from("recipes")
    .update({ source_shortcode: next.sourceShortcode, data: next, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new DuplicateError("Another recipe already uses that Instagram link.");
    throw new Error(error.message);
  }
  return toRecipe(data as Row);
}

export async function deleteRecipe(id: string) {
  const current = await getRecipe(id);
  const { error } = await db().from("recipes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  // Tidy up the stored photo too (best effort).
  const path = current?.imageUrl ? storagePathFromUrl(current.imageUrl) : null;
  if (path) await db().storage.from(IMAGE_BUCKET).remove([path]).catch(() => {});
}

// ---------- Images ----------
export function storagePathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
  const i = url.indexOf(marker);
  return i >= 0 ? url.slice(i + marker.length) : null;
}

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 6 * 1024 * 1024;

export async function storeImage(bytes: Uint8Array, contentType: string): Promise<string> {
  const type = contentType.split(";")[0].trim().toLowerCase();
  if (!ALLOWED.has(type)) throw new Error("Please use a JPG, PNG or WebP image.");
  if (bytes.byteLength > MAX_BYTES) throw new Error("That image is too large (max 6 MB).");
  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const path = `${crypto.randomUUID()}.${ext}`; // long random name = unguessable
  const { error } = await db().storage.from(IMAGE_BUCKET).upload(path, bytes, { contentType: type, upsert: false });
  if (error) throw new Error(error.message);
  return db().storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; type: string } {
  const m = dataUrl.match(/^data:([^;,]+);base64,(.*)$/);
  if (!m) throw new Error("Invalid image data");
  return { bytes: Uint8Array.from(Buffer.from(m[2], "base64")), type: m[1] };
}

/** Download a remote image (e.g. an Instagram thumbnail) and keep our own copy. */
export async function copyRemoteImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    const bytes = new Uint8Array(await res.arrayBuffer());
    return await storeImage(bytes, type);
  } catch {
    return null;
  }
}
