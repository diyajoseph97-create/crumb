// Things shared to Crumb from the phone's share menu (see public/sw.js),
// plus the "Install app" prompt Chrome offers.

export type Shared = { title: string; text: string; url: string; files: File[] };

const DB = "crumb-share";
const STORE = "inbox";

// Some Android apps share files without a type; work it out from the name (default: video).
const EXT: Record<string, string> = { mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm", "3gp": "video/3gpp", mkv: "video/x-matroska", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic" };
function withType(f: File | Blob): File {
  const name = f instanceof File && f.name ? f.name : "shared";
  const ok = f.type && /^(video|image)\//.test(f.type);
  if (f instanceof File && ok) return f;
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const type = ok ? f.type : EXT[ext] || "video/mp4";
  return new File([f], name.includes(".") ? name : `${name}.${type === "video/mp4" ? "mp4" : ext || "bin"}`, { type });
}

/** Read what was just shared (if anything) and clear it, so it's only used once. */
export function takeShared(): Promise<Shared | null> {
  return new Promise((resolve) => {
    let open: IDBOpenDBRequest;
    try {
      open = indexedDB.open(DB, 1);
    } catch {
      return resolve(null);
    }
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => resolve(null);
    open.onsuccess = () => {
      const tx = open.result.transaction(STORE, "readwrite");
      const st = tx.objectStore(STORE);
      const get = st.get("latest");
      get.onsuccess = () => {
        const item = get.result as (Shared & { at?: number }) | undefined;
        st.delete("latest");
        if (!item) return resolve(null);
        resolve({
          title: item.title || "",
          text: item.text || "",
          url: item.url || "",
          files: (item.files || []).map(withType),
        });
      };
      get.onerror = () => resolve(null);
    };
  });
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // The page was opened from an older saved copy and a newer crumbs has just arrived.
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data?.type === "crumb-updated") window.dispatchEvent(new Event("crumb-updated"));
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// Chrome fires this when Crumb can be installed; we keep it for the Settings button.
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}
export const canInstall = () => Boolean(deferred);
export const onInstallChange = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export async function promptInstall() {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  listeners.forEach((l) => l());
  return outcome === "accepted";
}
export const isInstalled = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);

export type ShareReceipt = { title?: string; text?: string; url?: string; fileCount?: number; fileTypes?: string[]; error?: string; at: number };

/** The last thing the share menu sent (kept for troubleshooting). */
export function lastShareReceipt(): Promise<ShareReceipt | null> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        const get = open.result.transaction(STORE, "readonly").objectStore(STORE).get("last");
        get.onsuccess = () => resolve((get.result as ShareReceipt) || null);
        get.onerror = () => resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}
