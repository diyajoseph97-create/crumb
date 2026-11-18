// Crumb's service worker. Its one job: when you pick Crumb in your phone's
// share menu, Android sends the shared link/video here. We tuck it into the
// browser's storage and open Crumb, which picks it up and starts the import.
const DB = "crumb-share";
const STORE = "inbox";

function save(item, key = "latest") {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(item, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || !url.pathname.endsWith("/share-target")) return;
  event.respondWith(
    (async () => {
      const at = Date.now();
      try {
        const form = await event.request.formData();
        const files = form.getAll("media").filter((f) => f && typeof f === "object" && f.size > 0);
        const item = {
          title: String(form.get("title") || ""),
          text: String(form.get("text") || ""),
          url: String(form.get("url") || ""),
          files,
          at,
        };
        await save(item);
        // A small receipt (no files) so Settings can show what arrived last.
        await save({ title: item.title, text: item.text, url: item.url, fileCount: files.length, fileTypes: files.map((f) => f.type), at }, "last");
      } catch (err) {
        await save({ error: String(err && err.message ? err.message : err), at }, "last").catch(() => {});
      }
      return Response.redirect(new URL("./#shared", self.registration.scope).href, 303);
    })(),
  );
});
