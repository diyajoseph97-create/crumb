// Things shared to Crumb from the phone's share menu (see public/sw.js),
// plus the "Install app" prompt Chrome offers.

export type Shared = { title: string; text: string; url: string; files: File[] };

const DB = "crumb-share";
const STORE = "inbox";

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
          files: (item.files || []).map((f) => (f instanceof File ? f : new File([f], "shared", { type: (f as Blob).type }))),
        });
      };
      get.onerror = () => resolve(null);
    };
  });
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
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
