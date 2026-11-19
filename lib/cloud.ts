import { BUILT_IN_SUPABASE } from "./cloud-config";
// A tiny Supabase client (auth by email + the "recipes" table), written with
// plain fetch so Crumb stays small. Your project URL and publishable key are
// public by design; only you can read your recipes because of the table's
// row-level security rule (see README).

export type CloudConfig = { url: string; key: string };
export type Session = { access_token: string; refresh_token: string; expires_at: number; user_id: string; email: string };
export type Row = { id: string; data: any; deleted: boolean; synced_at: string; updated_at?: string };

const CONFIG = "crumb-sync-config";
const SESSION = "crumb-sync-session";

const read = <T,>(k: string): T | null => {
  try {
    return JSON.parse(localStorage.getItem(k) || "null");
  } catch {
    return null;
  }
};
const write = (k: string, v: unknown) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

export const getConfig = (): CloudConfig | null =>
  read<CloudConfig>(CONFIG) ?? (BUILT_IN_SUPABASE.url && BUILT_IN_SUPABASE.key ? BUILT_IN_SUPABASE : null);
export const isBuiltInConfig = () => !read<CloudConfig>(CONFIG) && Boolean(BUILT_IN_SUPABASE.url && BUILT_IN_SUPABASE.key);
export const getSession = () => read<Session>(SESSION);
export const setSession = (s: Session | null) => write(SESSION, s);

/** Checks and saves the project URL and publishable key. Returns an error message or null. */
export function setConfig(urlRaw: string, keyRaw: string): string | null {
  const key = keyRaw.trim();
  let url = urlRaw.trim().replace(/\/+$/, "");
  if (/^[a-z0-9]{15,}$/i.test(url)) url = `https://${url}.supabase.co`; // just the project ref
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return "The project URL should start with https://";
    url = u.origin;
  } catch {
    return "That doesn't look like a project URL. It looks like https://abcd1234.supabase.co";
  }
  if (/^sb_secret_/.test(key) || /service_role/.test(decodeJwt(key)?.role ?? "")) return "That's the secret key. Use the publishable (or anon public) key instead.";
  if (!/^sb_publishable_/.test(key) && decodeJwt(key)?.role !== "anon") return "That doesn't look like the publishable key. It starts with sb_publishable_ (or is the long “anon public” key).";
  write(CONFIG, { url, key });
  return null;
}
export function clearConfig() {
  write(CONFIG, null);
  write(SESSION, null);
}

function decodeJwt(token: string): any {
  try {
    const part = token.split(".")[1];
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

/** A short code that sets up sync on another device (project URL + publishable key, not your sign-in). */
export function setupLink(): string | null {
  const c = getConfig();
  if (!c) return null;
  const code = btoa(JSON.stringify(c)).replace(/=+$/, "");
  return `${location.origin}${location.pathname}#connect=${code}`;
}
export function applySetupCode(code: string): boolean {
  try {
    const c = JSON.parse(atob(code)) as CloudConfig;
    return setConfig(c.url, c.key) === null;
  } catch {
    return false;
  }
}

async function errorText(res: Response) {
  const body = await res.text().catch(() => "");
  try {
    const j = JSON.parse(body);
    return j.msg || j.message || j.error_description || j.error || body;
  } catch {
    return body || `HTTP ${res.status}`;
  }
}

export class CloudError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function auth(path: string, body: unknown) {
  const c = getConfig();
  if (!c) throw new CloudError("Sync isn't set up yet.", 0);
  const res = await fetch(`${c.url}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: c.key, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new CloudError(await errorText(res), res.status);
  return res.status === 204 ? null : res.json();
}

function toSession(j: any): Session {
  const claims = decodeJwt(j.access_token) || {};
  return {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: j.expires_at ? j.expires_at * 1000 : Date.now() + (j.expires_in ?? 3600) * 1000,
    user_id: j.user?.id ?? claims.sub,
    email: j.user?.email ?? claims.email ?? "",
  };
}

/** Sends the sign-in email (a link, and a 6-digit code if your email template includes it). */
export async function sendSignInEmail(email: string) {
  const c = getConfig();
  const redirect = encodeURIComponent(`${location.origin}${location.pathname}`);
  await auth(`otp?redirect_to=${redirect}`, { email: email.trim(), create_user: true });
  return c;
}

/** Signs in with the code from the email. */
export async function verifyCode(email: string, code: string) {
  const j = await auth("verify", { type: "email", email: email.trim(), token: code.trim() });
  const s = toSession(j);
  setSession(s);
  return s;
}

/** If the sign-in link came back with an error (expired, already used…), a plain explanation. */
export function takeSignInErrorFromUrl(): string | null {
  const params = new URLSearchParams(location.hash.slice(1) + "&" + location.search.slice(1));
  const code = params.get("error_code") || params.get("error");
  if (!code) return null;
  const desc = (params.get("error_description") || "").replace(/\+/g, " ");
  history.replaceState(null, "", location.pathname);
  if (/otp_expired|expired|invalid/i.test(code + desc))
    return "That sign-in link has expired or was already used. Links work once and only for a short while, so send a new one and open it straight away, in this browser.";
  if (/access_denied/i.test(code)) return `Supabase didn't allow that sign-in${desc ? ` (${desc})` : ""}. Send a new link and try again.`;
  return `Sign-in didn't work${desc ? `: ${desc}` : ""}.`;
}

/** The sign-in link brings you back with the session in the address (#access_token=…). */
export function takeSessionFromUrl(): boolean {
  const h = location.hash;
  if (!h.includes("access_token=")) return false;
  const p = new URLSearchParams(h.slice(1));
  const access_token = p.get("access_token");
  const refresh_token = p.get("refresh_token");
  if (access_token && refresh_token) {
    setSession(toSession({ access_token, refresh_token, expires_at: Number(p.get("expires_at")) || undefined, expires_in: Number(p.get("expires_in")) || 3600 }));
  }
  history.replaceState(null, "", location.pathname + location.search);
  return Boolean(access_token);
}

let refreshing: Promise<Session | null> | null = null;
/** A valid session, refreshed if it's about to expire. Null if signed out. */
export async function freshSession(): Promise<Session | null> {
  const s = getSession();
  if (!s) return null;
  if (s.expires_at - Date.now() > 60_000) return s;
  refreshing ??= auth("token?grant_type=refresh_token", { refresh_token: s.refresh_token })
    .then((j) => {
      const next = toSession(j);
      setSession(next);
      return next;
    })
    .catch((e: CloudError) => {
      if (e.status === 400 || e.status === 401) setSession(null); // sign-in expired or revoked
      throw e;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export function signOut() {
  const s = getSession();
  const c = getConfig();
  setSession(null);
  if (s && c) fetch(`${c.url}/auth/v1/logout`, { method: "POST", headers: { apikey: c.key, authorization: `Bearer ${s.access_token}` } }).catch(() => {});
}

async function rest(path: string, init: RequestInit = {}) {
  const c = getConfig();
  const s = await freshSession();
  if (!c || !s) throw new CloudError("Not signed in.", 401);
  const res = await fetch(`${c.url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: c.key, authorization: `Bearer ${s.access_token}`, "content-type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) throw new CloudError(await errorText(res), res.status);
  return res;
}

/** Rows changed since `since` (ISO time), oldest first. */
export async function pullRows(since: string | null, limit = 200): Promise<Row[]> {
  const filter = since ? `&synced_at=gt.${encodeURIComponent(since)}` : "";
  const res = await rest(`recipes?select=id,data,deleted,synced_at${filter}&order=synced_at.asc&limit=${limit}`);
  return res.json();
}

/** Insert or update rows (same id = update). */
export async function pushRows(rows: { id: string; data: any; deleted: boolean; updated_at: string }[]) {
  const s = getSession();
  if (!rows.length || !s) return;
  await rest("recipes?on_conflict=user_id,id", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows.map((r) => ({ ...r, user_id: s.user_id }))),
  });
}

// ---------- View-only sharing ----------
// A share is a long random token saved in your "shares" table. Anyone with the
// link can call the read-only shared_cookbook() function with that token; it
// returns your recipes (or one recipe) and nothing else. Nobody can change anything.

export type Share = { token: string; recipe_id: string | null; title: string; created_at: string };
export type SharedCookbook = { title: string; recipe_id: string | null; recipes: any[] };

const b64url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The link someone else opens. It carries your project address + publishable key (both public) and the share token. */
export function shareUrl(token: string, recipeId: string | null) {
  const c = getConfig();
  if (!c) return "";
  const code = b64url(JSON.stringify({ u: c.url, k: c.key, t: token }));
  return `${location.origin}${location.pathname}?s=${code}${recipeId ? `#recipe-${recipeId}` : ""}`;
}
export function readShareCode(code: string): { url: string; key: string; token: string } | null {
  try {
    const j = JSON.parse(unb64url(code));
    return j.u && j.k && j.t ? { url: j.u, key: j.k, token: j.t } : null;
  } catch {
    return null;
  }
}

export async function createShare(recipeId: string | null, title: string): Promise<Share> {
  const s = getSession();
  if (!s) throw new CloudError("Not signed in.", 401);
  const share = { token: randomToken(), recipe_id: recipeId, title: title.trim().slice(0, 80) || "crumbs", user_id: s.user_id };
  await rest("shares", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify(share) });
  return { ...share, created_at: new Date().toISOString() };
}
export async function listShares(): Promise<Share[]> {
  const res = await rest("shares?select=token,recipe_id,title,created_at&order=created_at.desc");
  return res.json();
}
export async function deleteShare(token: string) {
  await rest(`shares?token=eq.${encodeURIComponent(token)}`, { method: "DELETE", headers: { prefer: "return=minimal" } });
}

/** For the person you shared with: no sign-in, read-only. Null if the link was turned off. */
export async function fetchShared(code: { url: string; key: string; token: string }): Promise<SharedCookbook | null> {
  const res = await fetch(`${code.url}/rest/v1/rpc/shared_cookbook`, {
    method: "POST",
    headers: { apikey: code.key, "content-type": "application/json" },
    body: JSON.stringify({ share_token: code.token }),
  });
  if (!res.ok) throw new CloudError(await errorText(res), res.status);
  const j = await res.json();
  return j && Array.isArray(j.recipes) ? j : null;
}

// ---------- Your Gemini key on all your devices (optional) ----------
// Stored in your own Supabase "user_settings" table; only you can read it.
export async function getRemoteKey(): Promise<string | null> {
  const res = await rest("user_settings?select=gemini_key&limit=1");
  const rows = (await res.json()) as { gemini_key: string | null }[];
  return rows[0]?.gemini_key || null;
}
export async function setRemoteKey(key: string | null) {
  const s = getSession();
  if (!s) return;
  await rest("user_settings?on_conflict=user_id", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: s.user_id, gemini_key: key, updated_at: new Date().toISOString() }),
  });
}
