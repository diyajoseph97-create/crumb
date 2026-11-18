// Passphrase gate. After you enter the passphrase once, the server gives your
// browser a cookie containing a signature that only the server can produce.
// Every page and API request checks that cookie.

export const COOKIE_NAME = "crumb_session";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export function authConfigured() {
  return Boolean(process.env.CRUMB_PASSPHRASE && process.env.CRUMB_SESSION_SECRET);
}

/** The value a valid cookie must have. Changes if you change the secret (which logs out every device). */
export async function expectedToken(): Promise<string> {
  const secret = process.env.CRUMB_SESSION_SECRET ?? "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("crumb-session-v1"));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compare two strings without leaking how much matched (timing-safe). */
export function safeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

export async function isValidSession(cookie: string | undefined) {
  if (!authConfigured() || !cookie) return false;
  return safeEqual(cookie, await expectedToken());
}
