// Keeps this device's cookbook in step with your other devices through Supabase.
// Recipes still live on this device first (so Crumb works offline, and keeps
// working if the free Supabase project is paused); sync copies changes both ways.
import type { Recipe } from "./types";
import { onLocalChange, raw } from "./local-store";
import { normaliseRecipe } from "./validate";
import { CloudError, getConfig, getSession, pullRows, pushRows, type Row } from "./cloud";

export type SyncStatus =
  | { state: "off" } // not set up on this device
  | { state: "signed-out" }
  | { state: "syncing" }
  | { state: "synced"; at: number }
  | { state: "paused"; message: string; at: number };

const PENDING = "crumb-sync-pending"; // { [id]: { op: "put" | "delete", seq } }
const CURSOR = "crumb-sync-cursor"; // latest synced_at pulled
const LINKED = "crumb-sync-linked"; // user id this device's cookbook was merged with

type Pending = Record<string, { op: "put" | "delete"; seq: number }>;
const load = <T,>(k: string, d: T): T => {
  try {
    return JSON.parse(localStorage.getItem(k) || "null") ?? d;
  } catch {
    return d;
  }
};
const save = (k: string, v: unknown) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

let status: SyncStatus = { state: "off" };
const statusListeners = new Set<(s: SyncStatus) => void>();
const remoteListeners = new Set<() => void>();
const setStatus = (s: SyncStatus) => {
  status = s;
  statusListeners.forEach((fn) => fn(s));
};
export const getSyncStatus = () => status;
export function onSyncStatus(fn: (s: SyncStatus) => void) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}
/** Called after recipes from another device were saved here, so the screen can refresh. */
export function onRemoteChanges(fn: () => void) {
  remoteListeners.add(fn);
  return () => remoteListeners.delete(fn);
}

let seq = Date.now();
function markPending(id: string, op: "put" | "delete") {
  const p = load<Pending>(PENDING, {});
  p[id] = { op, seq: ++seq };
  save(PENDING, p);
}

const completeness = (r: Recipe) => r.ingredients.length + r.steps.length + (r.imageUrl ? 1 : 0);
const toRow = (r: Recipe) => ({ id: r.id, data: r, deleted: false, updated_at: r.updatedAt });
const tombstone = (id: string) => ({ id, data: {}, deleted: true, updated_at: new Date().toISOString() });

async function pullAll(since: string | null): Promise<Row[]> {
  const out: Row[] = [];
  let cursor = since;
  for (let i = 0; i < 100; i++) {
    const page = await pullRows(cursor, 200);
    out.push(...page);
    if (page.length < 200) break;
    cursor = page[page.length - 1].synced_at;
  }
  return out;
}
const latest = (rows: Row[], prev: string | null) => rows.reduce((m, r) => (!m || r.synced_at > m ? r.synced_at : m), prev);

/** First sync on this device for this account: merge both cookbooks, matching up the same Reel/video saved on both. */
async function firstMerge(userId: string) {
  const remote = (await pullAll(null)).filter((r) => !r.deleted);
  const remoteById = new Map(remote.map((r) => [r.id, normaliseRecipe(r.data)]));
  const remoteBySource = new Map<string, Recipe>();
  remoteById.forEach((r) => r.sourceShortcode && remoteBySource.set(r.sourceShortcode, r));
  const local = (await raw.all()).map(normaliseRecipe);
  const localIds = new Set(local.map((r) => r.id));
  const toPush: { id: string; data: any; deleted: boolean; updated_at: string }[] = [];

  for (const r of local) {
    const same = remoteById.get(r.id);
    if (same) {
      if (r.updatedAt > same.updatedAt) toPush.push(toRow(r));
      else await raw.put(same);
      continue;
    }
    const twin = r.sourceShortcode ? remoteBySource.get(r.sourceShortcode) : undefined;
    if (twin && !localIds.has(twin.id)) {
      // The same video was saved on both devices: keep the fuller copy.
      if (completeness(r) > completeness(twin)) {
        toPush.push(toRow(r), tombstone(twin.id));
        remoteById.delete(twin.id);
      } else {
        await raw.remove(r.id);
      }
      continue;
    }
    toPush.push(toRow(r));
  }
  for (const [id, r] of remoteById) if (!localIds.has(id)) await raw.put(r);
  for (let i = 0; i < toPush.length; i += 8) await pushRows(toPush.slice(i, i + 8));
  save(PENDING, {});
  save(CURSOR, latest(remote, null));
  save(LINKED, userId);
  return true;
}

async function pushPending() {
  const snapshot = load<Pending>(PENDING, {});
  const ids = Object.keys(snapshot);
  for (let i = 0; i < ids.length; i += 8) {
    const batch = ids.slice(i, i + 8);
    const rows: { id: string; data: any; deleted: boolean; updated_at: string }[] = [];
    for (const id of batch) {
      const r = snapshot[id].op === "put" ? await raw.get(id) : undefined;
      rows.push(r ? toRow(normaliseRecipe(r)) : tombstone(id));
    }
    await pushRows(rows);
    // Forget only what we sent; a newer change made meanwhile stays pending.
    const now = load<Pending>(PENDING, {});
    for (const id of batch) if (now[id]?.seq === snapshot[id].seq) delete now[id];
    save(PENDING, now);
  }
}

async function pullChanges(): Promise<number> {
  const cursor = load<string | null>(CURSOR, null);
  // Re-read the last minute too, in case two saves landed at nearly the same moment.
  const since = cursor ? new Date(Date.parse(cursor) - 60_000).toISOString() : null;
  const rows = await pullAll(since);
  const pending = load<Pending>(PENDING, {});
  let changed = 0;
  for (const row of rows) {
    if (pending[row.id]) continue; // our unsent change wins; it goes up next
    const here = await raw.get(row.id);
    if (row.deleted) {
      if (here) {
        await raw.remove(row.id);
        changed++;
      }
      continue;
    }
    const r = normaliseRecipe(row.data);
    if (!here || r.updatedAt > here.updatedAt) {
      await raw.put(r);
      changed++;
    }
  }
  save(CURSOR, latest(rows, cursor));
  return changed;
}

let running: Promise<void> | null = null;
let again = false;

/** Sync now (or right after the current sync finishes). */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    const config = getConfig();
    const session = getSession();
    if (!config) return setStatus({ state: "off" });
    if (!session) return setStatus({ state: "signed-out" });
    setStatus({ state: "syncing" });
    try {
      let changed = 0;
      if (load<string | null>(LINKED, null) !== session.user_id) {
        await firstMerge(session.user_id);
        changed = 1;
      } else {
        await pushPending();
        changed = await pullChanges();
      }
      if (changed) remoteListeners.forEach((fn) => fn());
      setStatus({ state: "synced", at: Date.now() });
    } catch (e) {
      if (e instanceof CloudError && e.status === 401 && !getSession()) return setStatus({ state: "signed-out" });
      setStatus({ state: "paused", message: describe(e), at: Date.now() });
    }
  })().finally(() => {
    running = null;
    if (again) {
      again = false;
      setTimeout(syncNow, 500);
    }
  });
  return running;
}

function describe(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (!navigator.onLine) return "You're offline. Changes are saved here and will sync when you're back online.";
  if (/relation .*recipes.* does not exist|Could not find the table/i.test(msg)) return "The recipes table is missing. Run the setup SQL in your Supabase project.";
  if (/JWT|invalid api key|No API key/i.test(msg)) return "Supabase didn't accept the publishable key. Check it in Settings.";
  return "Can't reach your Supabase project. If it lasts, open supabase.com and restore the project (free projects pause after a quiet week). Your changes are safe here.";
}

/** Called after signing out or disconnecting: next sign-in merges again. */
export function resetSyncState() {
  save(PENDING, {});
  save(CURSOR, null);
  save(LINKED, null);
  setStatus(getConfig() ? { state: "signed-out" } : { state: "off" });
}

let timer: ReturnType<typeof setTimeout> | null = null;
const soon = (ms: number) => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => syncNow(), ms);
};

/** Start watching for changes. Safe to call once at start-up. */
export function startSync() {
  onLocalChange(({ id, deleted }) => {
    markPending(id, deleted ? "delete" : "put");
    if (getConfig() && getSession()) soon(1500);
  });
  window.addEventListener("online", () => soon(0));
  window.addEventListener("focus", () => soon(300));
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && soon(300));
  setInterval(() => document.visibilityState === "visible" && syncNow(), 60_000);
  syncNow();
}
