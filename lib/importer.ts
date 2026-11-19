// Adding a recipe happens in the background: the Add screen hands over an
// ImportJob, closes, and the cookbook shows a "being added" card until it's done.
import type { Recipe, RecipeDraft } from "./types";
import type { Store } from "./store";
import { mergeIntoExisting, readRecipe } from "./gemini";
import { captureFrame } from "./video-frame";
import { cleanPhoto } from "./trim";
import { dataUrlToFile, fetchReelPreview, type ReelPreview } from "./reel";
import { canonicalInstagramUrl, emptyDraft, isYouTube, youtubeCreator, youtubeThumbnail, youtubeVideoId } from "./recipe-utils";

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
  /** What it's doing right now, shown on the card. */
  stage?: string;
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

export async function runImport(job: ImportInput, deps: { apiKey: string; store: Store; existing: Recipe | null; onStage?: (s: string) => void }): Promise<Recipe> {
  const { apiKey, store, existing, onStage } = deps;
  const ytUrl = job.code && isYouTube(job.code) ? canonicalInstagramUrl(job.code) : existing && isYouTube(existing.sourceShortcode) ? existing.sourceUrl : null;

  // Instagram with no video: read the Reel's public caption and cover first.
  const igCode = job.code && !isYouTube(job.code) ? job.code : existing && existing.sourceShortcode && !isYouTube(existing.sourceShortcode) ? existing.sourceShortcode : null;
  const hasVideo = job.files.some((f) => f.type.startsWith("video/"));
  let preview: ReelPreview | null = null;
  if (igCode && !hasVideo) {
    onStage?.("Reading the Instagram caption");
    preview = await fetchReelPreview(igCode);
  }
  const pastedCaption = job.caption.trim() || existing?.originalCaption || "";
  const caption = pastedCaption || preview?.caption || "";
  const files = [...job.files];
  if (preview?.image && !files.some((f) => f.type.startsWith("image/"))) files.push(dataUrlToFile(preview.image, "cover.jpg"));

  // Nothing to read at all: keep the link for later.
  if (!files.length && !caption && !ytUrl && !existing) return saveLater(job, store, null);

  const result = await readRecipe({
    apiKey,
    files,
    text: caption,
    existing: existing ?? undefined,
    youtubeUrl: ytUrl,
    onStage: (st) => onStage?.(st === "busy" ? "Google is busy, trying again" : st === "upload" && hasVideo ? "Sending the video" : "Reading the recipe"),
  });
  onStage?.("Saving");
  if (!result.isRecipe && !existing) {
    // Only the Reel's caption to go on, and it wasn't a recipe: save it to finish with the video.
    if (igCode && !job.files.length && !job.caption.trim()) return saveLater(job, store, preview);
    throw new NotARecipe("No recipe found in that. Try a video or screenshots that show the ingredients and method.");
  }

  // Photo: a frame of the finished dish from the video, or the YouTube thumbnail.
  const video = job.files.find((f) => f.type.startsWith("video/"));
  let imageUrl: string | null = null;
  if (video && result.heroFrameSeconds != null && !existing?.imageUrl) {
    const frame = await captureFrame(video, result.heroFrameSeconds, result.dishBox);
    if (frame) imageUrl = await store.uploadImage(frame).catch(() => null);
  }
  const ytId = youtubeVideoId(ytUrl);
  if (!imageUrl && ytId && !existing?.imageUrl) imageUrl = await youtubeThumbnail(ytId).catch(() => null);
  // Trim the blurred side bars Instagram (and black ones YouTube Shorts) add around tall videos.
  // Instagram: the Reel's cover.
  if (!imageUrl && preview?.image && !existing?.imageUrl) imageUrl = await store.uploadImage(preview.image).catch(() => null);
  if (imageUrl) imageUrl = await cleanPhoto(imageUrl);
  // The account that posted it.
  if (preview?.creator && !existing?.creator) result.draft.creator = `@${preview.creator.replace(/^@/, "")}`;
  // YouTube says who the channel is; that beats anything read from the video.
  if (ytId && !existing?.creator) {
    const channel = await youtubeCreator(ytId);
    if (channel) result.draft.creator = channel;
  }

  const usedCaption = caption;
  const sources = [video || ytUrl ? "video" : "", job.files.some((f) => f.type.startsWith("image/")) ? "screenshots" : "", usedCaption ? "caption" : ""].filter(Boolean);
  const readFrom = sources.length ? `Read from the ${sources.join(", ").replace(/, ([^,]*)$/, " and $1")}.` : "";
  const notes = [result.notes, readFrom].filter(Boolean).join(" ");

  if (existing) {
    const patch = mergeIntoExisting(existing, result.draft);
    if (!result.isRecipe && igCode && !job.files.length) patch.importNotes = LATER_NOTE;
    if (imageUrl) patch.imageUrl = imageUrl;
    if (patch.importNotes !== LATER_NOTE) patch.importNotes = notes;
    if (caption && !existing.originalCaption) patch.originalCaption = caption;
    return store.update(existing.id, patch);
  }
  const draft: RecipeDraft = {
    ...emptyDraft(),
    ...result.draft,
    name: result.draft.name || "Untitled recipe",
    imageUrl,
    sourceUrl: job.code ? canonicalInstagramUrl(job.code) : null,
    sourceShortcode: job.code,
    originalCaption: caption || null,
    importNotes: notes + (igCode && !hasVideo && !result.draft.steps?.length ? " The steps weren't in the caption: add the video to fill them in." : ""),
  };
  return store.create(draft);
}

export const LATER_NOTE: string = "The recipe wasn't in the caption. Record or download the Reel, then tap “Add the video” to finish it.";
const NO_PREVIEW_NOTE = "Saved the link. Record or download the Reel, then tap “Add the video” to finish it.";

/** Keep an Instagram link (with its caption, cover and creator, if we got them) to finish later. */
export async function saveLater(job: ImportInput, store: Store, preview: ReelPreview | null): Promise<Recipe> {
  const code = job.code!;
  const firstLine = preview?.caption?.split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#"));
  let imageUrl: string | null = null;
  if (preview?.image) imageUrl = await store.uploadImage(preview.image).then(cleanPhoto).catch(() => null);
  return store.create({
    ...emptyDraft(),
    name: firstLine && firstLine.length <= 80 ? firstLine : "Recipe from Instagram",
    imageUrl,
    creator: preview?.creator ? `@${preview.creator.replace(/^@/, "")}` : null,
    sourceUrl: canonicalInstagramUrl(code),
    sourceShortcode: code,
    originalCaption: job.caption.trim() || preview?.caption || null,
    importNotes: preview ? LATER_NOTE : NO_PREVIEW_NOTE,
  });
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
