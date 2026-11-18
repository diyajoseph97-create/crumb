// "Add another device": packs this device's settings into a link, locked with a
// PIN you choose (PBKDF2 + AES-GCM, done by the browser's built-in crypto).
// The locked data sits after the "#" in the link, so it's never sent to any server.
import type { Settings } from "./github";

const ITERATIONS = 310000;

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function keyFromPin(pin: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function lockSettings(s: Settings, pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFromPin(pin, salt);
  const plain = new TextEncoder().encode(JSON.stringify({ o: s.owner, r: s.repo, t: s.token, g: s.geminiKey }));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
  const out = new Uint8Array(salt.length + iv.length + cipher.length);
  out.set(salt, 0);
  out.set(iv, 16);
  out.set(cipher, 28);
  return b64url(out);
}

/** Returns the settings, or null if the PIN is wrong / the link is damaged. */
export async function unlockSettings(payload: string, pin: string): Promise<Settings | null> {
  try {
    const bytes = fromB64url(payload);
    const key = await keyFromPin(pin, bytes.slice(0, 16));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(16, 28) }, key, bytes.slice(28));
    const o = JSON.parse(new TextDecoder().decode(plain));
    return { owner: o.o, repo: o.r, token: o.t, geminiKey: o.g ?? "" };
  } catch {
    return null;
  }
}

export function appBaseUrl() {
  return window.location.origin + window.location.pathname;
}

export function joinLink(payload: string) {
  return `${appBaseUrl()}#join=${payload}`;
}
