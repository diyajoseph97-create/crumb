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

// Offline copy of the app. The build stamps a new version on every deploy.
const CACHE = "crumb-06a60feadf";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })(),
  ),
);

// Page: try the network first (so updates show up). With a saved copy on the
// phone, wait at most 1.2 s on a weak connection before opening that instead;
// the new version is saved in the background for next time.
async function page(request) {
  const cache = await caches.open(CACHE);
  const fresh = fetch(request).then((res) => {
    if (res.ok) cache.put("./", res.clone());
    return res;
  });
  const saved = await cache.match("./");
  const timeout = new Promise((r) => setTimeout(r, saved ? 1200 : 8000, null));
  try {
    const res = await Promise.race([fresh, timeout]);
    if (res) return res;
  } catch {}
  return saved || fresh;
}

// Fonts and icons never change name, so the saved copy is always right.
async function asset(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const inScope = url.origin === location.origin && url.pathname.startsWith(new URL(self.registration.scope).pathname);
  if (event.request.method === "GET" && inScope) {
    if (event.request.mode === "navigate") return event.respondWith(page(event.request));
    if (/\/(fonts|icons)\//.test(url.pathname)) return event.respondWith(asset(event.request));
    return;
  }
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
