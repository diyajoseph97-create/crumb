// Adding a recipe happens in the background: the Add screen hands over an
// ImportJob, closes, and the cookbook shows a "being added" card until it's done.
import type { Recipe, RecipeDraft } from "./types";
import type { Store } from "./store";
import { mergeIntoExisting, readRecipe } from "./gemini";
import { captureFrame } from "./video-frame";
import { canonicalInstagramUrl, emptyDraft, isYouTube, youtubeThumbnail, youtubeVideoId } from "./recipe-utils";

export type ImportInput = {
  files: File[];
  caption: string;
  /** Source key (Instagram shortcode or yt:ID), if a link was given. */
  code: string | null;
  /** When set, fill in this existing recipe instead of making a new one. */
  fillId: string | null;
};

export type ImportJob = ImportInput & {
  id: string;
  status: "adding" | "failed";
  error?: string;
  /** A picture to show while it's being added (YouTube thumbnail), if we have one. */
  thumb: string | null;
  startedAt: number;
};

export function newJob(input: ImportInput): ImportJob {
  const yt = youtubeVideoId(input.code);
  return {
    ...input,
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: "adding",
    thumb: yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null,
    startedAt: Date.now(),
  };
}

export class NotARecipe extends Error {}

export async function runImport(job: ImportInput, deps: { apiKey: string; store: Store; existing: Recipe | null }): Promise<Recipe> {
  const { apiKey, store, existing } = deps;
  const ytUrl = job.code && isYouTube(job.code) ? canonicalInstagramUrl(job.code) : existing && isYouTube(existing.sourceShortcode) ? existing.sourceUrl : null;

  const result = await readRecipe({
    apiKey,
    files: job.files,
    text: job.caption.trim() || existing?.originalCaption || "",
    existing: existing ?? undefined,
    youtubeUrl: ytUrl,
  });
  if (!result.isRecipe && !existing) throw new NotARecipe("No recipe found in that. Try a video or screenshots that show the ingredients and method.");

  // Photo: a frame of the finished dish from the video, or the YouTube thumbnail.
  const video = job.files.find((f) => f.type.startsWith("video/"));
  let imageUrl: string | null = null;
  if (video && result.heroFrameSeconds != null && !existing?.imageUrl) {
    const frame = await captureFrame(video, result.heroFrameSeconds);
    if (frame) imageUrl = await store.uploadImage(frame).catch(() => null);
  }
  const ytId = youtubeVideoId(ytUrl);
  if (!imageUrl && ytId && !existing?.imageUrl) imageUrl = await youtubeThumbnail(ytId).catch(() => null);

  const usedCaption = job.caption.trim() || existing?.originalCaption;
  const sources = [video || ytUrl ? "video" : "", job.files.some((f) => f.type.startsWith("image/")) ? "screenshots" : "", usedCaption ? "caption" : ""].filter(Boolean);
  const readFrom = sources.length ? `Read from the ${sources.join(", ").replace(/, ([^,]*)$/, " and $1")}.` : "";
  const notes = [result.notes, readFrom].filter(Boolean).join(" ");

  if (existing) {
    const patch = mergeIntoExisting(existing, result.draft);
    if (imageUrl) patch.imageUrl = imageUrl;
    patch.importNotes = notes;
    if (job.caption.trim() && !existing.originalCaption) patch.originalCaption = job.caption.trim();
    return store.update(existing.id, patch);
  }
  const draft: RecipeDraft = {
    ...emptyDraft(),
    ...result.draft,
    name: result.draft.name || "Untitled recipe",
    imageUrl,
    sourceUrl: job.code ? canonicalInstagramUrl(job.code) : null,
    sourceShortcode: job.code,
    originalCaption: job.caption.trim() || null,
    importNotes: notes,
  };
  return store.create(draft);
}

// ---------- Saved jobs ----------
// Recipes being added are saved on the device (videos included), so if the phone
// closes Crumb in the background, they carry on the next time it opens.
const JOB_DB = "crumb-jobs";
const JOB_STORE = "jobs";
function jobDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(JOB_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(JOB_STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function jobTx(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest | void): Promise<any> {
  const d = await jobDb();
  return new Promise((resolve, reject) => {
    const t = d.transaction(JOB_STORE, mode);
    const req = run(t.objectStore(JOB_STORE));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
  });
}
export const saveJob = (job: ImportJob) => jobTx("readwrite", (s) => s.put(job)).catch(() => {});
export const forgetJob = (id: string) => jobTx("readwrite", (s) => s.delete(id)).catch(() => {});
export async function savedJobs(): Promise<ImportJob[]> {
  const all = ((await jobTx("readonly", (s) => s.getAll()).catch(() => [])) || []) as ImportJob[];
  return all
    .map((j) => ({ ...j, files: (j.files || []).map((f: Blob | File) => (f instanceof File ? f : new File([f], "video", { type: f.type }))) }))
    .sort((a, b) => b.startedAt - a.startedAt);
}
