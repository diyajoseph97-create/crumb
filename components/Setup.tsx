import { useEffect, useRef, useState } from "react";
import type { Recipe } from "@/lib/types";
import { getShareTitle, makeShareLink, sendLink, setShareTitle } from "@/lib/sharing";
import { deleteShare, listShares, shareUrl, type Share } from "@/lib/cloud";
import { isBuiltInConfig, setRemoteKey } from "@/lib/cloud";
import { clearConfig, getConfig, getSession, sendSignInEmail, setConfig, setupLink, signOut, verifyCode } from "@/lib/cloud";
import { getSyncStatus, onSyncStatus, resetSyncState, syncNow, type SyncStatus } from "@/lib/sync";
import { canInstall, isInstalled, lastShareReceipt, onInstallChange, promptInstall, type ShareReceipt } from "@/lib/share";
import { downloadBackup, getGeminiKey, restoreBackup, setGeminiKey } from "@/lib/local-store";
import { Doodle, Icon } from "./ui";

function KeyField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span className="field-label">Gemini API key</span>
      <input className="input" type="password" value={value} onChange={(e) => onChange(e.target.value)} placeholder="AQ.…" autoComplete="off" spellCheck={false} />
      <span className="hint">
        Free from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a>: sign in, then click <em>Create API key</em> and copy it.
      </span>
    </label>
  );
}

// Google AI Studio now issues "AQ." keys; older keys start with "AIza". Both work.
const looksLikeKey = (k: string) => /^(AQ\.[\w.-]{20,}|AIza[\w-]{20,})$/.test(k.trim());

/** First visit: just the Gemini key (or skip). */
export function Welcome({ onDone }: { onDone: () => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return setError("Paste your Gemini key first, or skip and type recipes in yourself.");
    if (!looksLikeKey(key)) return setError("That doesn't look like a Gemini key. They start with “AQ.” (or “AIza” for older keys).");
    setGeminiKey(key.trim());
    onDone();
  }
  return (
    <main className="unlock">
      <form className="unlock-card setup-card" onSubmit={submit}>
        <Doodle name="pot" className="add-doodle" />
        <h1 className="h-display h-md">Welcome to Crumb's Cookbook</h1>
        <p className="muted">A little home for all your saved recipes. Paste an Instagram or YouTube link and Crumb writes up the recipe for you. It just needs a free Gemini key to read the videos.</p>
        <div className="setup-form col gap-sm">
          <KeyField value={key} onChange={(v) => { setKey(v); setError(null); }} />
          {error && <p className="form-error" role="alert">{error}</p>}
          <p className="muted small privacy-note">
            <Icon name="check" size={14} /> Your recipes and key stay on this device. You can sync them to your other devices later.
          </p>
          <button className="btn btn-primary btn-lg block">Open my cookbook</button>
        </div>
        <p className="add-alt">
          No key yet? <button type="button" className="link-btn" onClick={onDone}>Skip, I'll type recipes in</button>
        </p>
      </form>
    </main>
  );
}

/** Settings dialog inside the app. */
export function SettingsPanel({ onClose, onRestored, onKeyChange, recipes = [] }: { onClose: () => void; onRestored: () => void; onKeyChange: (k: string) => void; recipes?: Recipe[] }) {
  const [key, setKey] = useState(getGeminiKey());
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  type Tab = "key" | "sync" | "backup" | "phone";
  const [tab, setTab] = useState<Tab>(() =>
    sessionStorage.getItem("crumb-sign-in-error") || getSyncStatus().state === "paused" ? "sync" : "key",
  );
  const tabs: { id: Tab; label: string }[] = [
    { id: "key", label: "Your key" },
    { id: "sync", label: "Sync & sharing" },
    { id: "backup", label: "Backup" },
    ...(isPhone() || isInstalled() ? [{ id: "phone" as Tab, label: "Phone app" }] : []),
  ];

  function saveKey(e: React.FormEvent) {
    e.preventDefault();
    if (key.trim() && !looksLikeKey(key)) return setMsg({ text: "That doesn't look like a Gemini key. They start with “AQ.” (or “AIza” for older keys).", bad: true });
    setGeminiKey(key.trim());
    onKeyChange(key.trim());
    if (keyShared()) setRemoteKey(key.trim() || null).catch(() => {});
    setMsg({ text: key.trim() ? "Key saved." : "Key removed." });
  }

  async function restore(f?: File) {
    if (!f) return;
    try {
      const n = await restoreBackup(f);
      setMsg({ text: `Restored ${n} ${n === 1 ? "recipe" : "recipes"}.` });
      onRestored();
    } catch (e) {
      setMsg({ text: (e as Error).message, bad: true });
    }
  }

  return (
    <div className="settings">
      <h2 className="h-display h-md">A few little things.</h2>
      <p className="settings-intro">Make Crumb feel like your cookbook.</p>

      <div className="settings-tabs" role="tablist" aria-label="Settings">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`settings-tab ${tab === t.id ? "on" : ""}`} onClick={() => { setTab(t.id); setMsg(null); }}>
            {t.label}
            {t.id === "sync" && getSyncStatus().state === "paused" && <span className="sync-dot inline" aria-label="Sync paused" />}
          </button>
        ))}
      </div>

      <div hidden={tab !== "key"} role="tabpanel">
      <form className="settings-section col gap-sm" onSubmit={saveKey}>
        <KeyField value={key} onChange={(v) => { setKey(v); setMsg(null); }} />
        <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }}>Save key</button>
      </form>
      <KeyShareToggle />
      </div>

      <div hidden={tab !== "sync"} role="tabpanel">
        <SyncSection />
        <ShareSection recipes={recipes} />
      </div>

      <div hidden={tab !== "backup"} role="tabpanel">
      <section className="settings-section">
        <h3 className="settings-h">Backup</h3>
        <p className="muted small">
          {getSession()
            ? "Your recipes are synced and kept on this device. A backup file is still a handy safety net (Supabase's free plan has no backups of its own)."
            : "Your recipes live in this browser only. Clearing browser data or switching browsers removes them. Download a backup now and then (keep it in iCloud Drive or Google Drive), and restore it here if you ever need to."}
        </p>
        <div className="row gap-xs wrap">
          <button className="btn btn-primary btn-sm" onClick={async () => { const n = await downloadBackup(); setMsg({ text: `Backup of ${n} ${n === 1 ? "recipe" : "recipes"} downloaded.` }); }}>
            <Icon name="download" size={16} /> Download a backup
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={16} /> Restore from backup
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { restore(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      </section>
      </div>

      <div hidden={tab !== "phone"} role="tabpanel">
        <InstallSection />
      </div>

      {msg && <p className={msg.bad ? "form-error" : "form-ok"} role="status">{msg.text}</p>}
      <div className="settings-extra">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

/** "Share to Crumb" from Instagram needs Crumb installed as an app (Android + Chrome). */
export const isPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function InstallSection() {
  const [, force] = useState(0);
  useEffect(() => {
    const off = onInstallChange(() => force((n) => n + 1));
    return () => { off(); };
  }, []);
  const installed = isInstalled();
  const [last, setLast] = useState<ShareReceipt | null>(null);
  useEffect(() => {
    lastShareReceipt().then(setLast);
  }, []);
  if (!isPhone() && !installed) return null; // only useful on a phone
  const iphone = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (iphone) {
    const base = `${location.origin}${location.pathname}?add=`;
    return (
      <section className="settings-section">
        <h3 className="settings-h">Share to Crumb from Instagram or YouTube (iPhone)</h3>
        <p className="muted small">iPhones don't let websites appear in the share menu, but a free Apple Shortcut can do it. One-time setup:</p>
        <ol className="help-list">
          <li>Open the <strong>Shortcuts</strong> app and tap <strong>+</strong>. Name it <strong>Save to Crumb</strong>.</li>
          <li>Tap the <strong>ⓘ</strong> (or the name at the top) and turn on <strong>Show in Share Sheet</strong>. Set it to receive <strong>URLs</strong> and <strong>Text</strong>.</li>
          <li>Add the action <strong>URL Encode</strong> (it encodes the <em>Shortcut Input</em>).</li>
          <li>Add the action <strong>Open URLs</strong> and set it to: <code className="code-line">{base}</code> followed by the <em>URL Encoded Text</em> variable.</li>
          <li>Done. In Instagram or YouTube tap <strong>Share → Save to Crumb</strong>.</li>
        </ol>
        <button className="btn btn-outline btn-sm" onClick={() => navigator.clipboard.writeText(base).catch(() => {})}>Copy the Crumb address for step 4</button>
        <p className="muted small" style={{ marginTop: 10 }}>Tip: in Safari, tap <strong>Share → Add to Home Screen</strong> to keep Crumb on your home screen.</p>
      </section>
    );
  }
  return (
    <section className="settings-section">
      <h3 className="settings-h">Share from Instagram or YouTube (Android)</h3>
      {installed ? (
        <p className="muted small">Crumb is installed. Tap <strong>Share</strong> on a Reel or YouTube video, then pick <strong>Crumb</strong>. YouTube videos are read straight away; Instagram links go to <em>Saved for later</em> until you add the downloaded video.</p>
      ) : (
        <>
          <p className="muted small">
            Install Crumb on your Android phone and it appears in the share menu. Open this page in <strong>Chrome</strong> on the phone, then tap{" "}
            {canInstall() ? "the button below" : <>the <strong>⋮</strong> menu → <strong>Install app</strong> (or <strong>Add to home screen</strong>)</>}.
            The phone keeps its own cookbook, separate from your laptop. Use Backup to move recipes across.
          </p>
          {canInstall() && (
            <button className="btn btn-primary btn-sm" onClick={() => promptInstall()}>
              <Icon name="down" size={16} /> Install Crumb
            </button>
          )}
        </>
      )}
      <p className="muted small" style={{ marginTop: 10 }}>
        <strong>Last share received:</strong>{" "}
        {!last
          ? "nothing yet."
          : last.error
            ? `${new Date(last.at).toLocaleString()}, but it couldn't be read (${last.error}).`
            : `${new Date(last.at).toLocaleString()}: ${[last.title, last.text, last.url].filter(Boolean).join(" · ") || "(no text)"}${last.fileCount ? ` + ${last.fileCount} file(s) (${(last.fileTypes || []).join(", ")})` : ""}`}
      </p>
    </section>
  );
}

/** Sync across devices (Supabase). */
function SyncSection() {
  const [, rerender] = useState(0);
  const refresh = () => rerender((n) => n + 1);
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  useEffect(() => {
    const off = onSyncStatus(setStatus);
    return () => { off(); };
  }, []);
  const config = getConfig();
  const session = getSession();
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [email, setEmail] = useState(session?.email || "");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(() => {
    const e = sessionStorage.getItem("crumb-sign-in-error");
    if (!e) return null;
    sessionStorage.removeItem("crumb-sign-in-error");
    return { text: e, bad: true };
  });

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ text: (e as Error).message || "Something went wrong.", bad: true });
    } finally {
      setBusy(false);
    }
  }

  let body: React.ReactNode;
  if (!config) {
    body = (
      <form className="col gap-sm" onSubmit={(e) => { e.preventDefault(); const err = !url.trim() || !key.trim() ? "Paste both the Project URL and the publishable key." : setConfig(url, key); if (err) setMsg({ text: err, bad: true }); else { setMsg(null); resetSyncState(); refresh(); } }}>
        <p className="muted small">Keep one cookbook on your phone and laptop. Connect your Supabase project (Project Settings → API Keys).</p>
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Project URL (https://….supabase.co)" aria-label="Supabase project URL" autoComplete="off" spellCheck={false} />
        <input className="input" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Publishable key (sb_publishable_…)" aria-label="Supabase publishable key" autoComplete="off" spellCheck={false} />
        <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }}>Connect</button>
      </form>
    );
  } else if (!session) {
    body = (
      <div className="col gap-sm">
        {!sent ? (
          <form className="col gap-sm" onSubmit={(e) => { e.preventDefault(); if (!/.+@.+\..+/.test(email)) return setMsg({ text: "Type your email address first.", bad: true }); run(async () => { await sendSignInEmail(email); setSent(true); }); }}>
            <p className="muted small">Sign in with your email. Use the same email on each device.</p>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email" autoComplete="email" />
            <button className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }} disabled={busy}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
          </form>
        ) : (
          <form className="col gap-sm" onSubmit={(e) => { e.preventDefault(); if (code.length < 6) return setMsg({ text: "Type the 6-digit code from the email.", bad: true }); run(async () => { await verifyCode(email, code); refresh(); syncNow(); }); }}>
            <p className="muted small">We've emailed <strong>{email}</strong>. Open that email <strong>on this device</strong> and tap <strong>Sign in</strong>. Crumb opens already signed in. (If the email shows a code instead, type it below.)</p>
            <input className="input" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Code (only if the email has one)" aria-label="Sign-in code" autoComplete="one-time-code" />
            <div className="row gap-xs wrap">
              <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Checking…" : "Sign in with code"}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSent(false); setCode(""); }}>Use a different email</button>
            </div>
          </form>
        )}
        {!isBuiltInConfig() && <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => { clearConfig(); resetSyncState(); refresh(); }}>Change Supabase project</button>}
      </div>
    );
  } else {
    const line =
      status.state === "syncing" ? "Syncing…" :
      status.state === "synced" ? `Up to date · ${new Date(status.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` :
      status.state === "paused" ? status.message : "Waiting to sync…";
    const link = setupLink();
    body = (
      <div className="col gap-sm">
        <p className="small"><strong>Syncing as {session.email}.</strong></p>
        <p className={`small ${status.state === "paused" ? "sync-warn" : "muted"}`} role="status">{line}</p>
        <div className="row gap-xs wrap">
          <button className="btn btn-outline btn-sm" onClick={() => syncNow()} disabled={status.state === "syncing"}>Sync now</button>
          {link && (
            <button className="btn btn-outline btn-sm" onClick={async () => {
              const nav = navigator as Navigator & { share?: (d: { title?: string; url?: string }) => Promise<void> };
              if (nav.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) await nav.share({ title: "Set up Crumb sync", url: link }).catch(() => {});
              else { await navigator.clipboard.writeText(link).catch(() => {}); setMsg({ text: "Set-up link copied. Open it on your other device, then sign in with the same email." }); }
            }}>Set up another device</button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => { signOut(); resetSyncState(); refresh(); }}>Sign out</button>
        </div>
        <p className="muted small">Your recipes stay on this device too, so Crumb works offline and if sync pauses.</p>
      </div>
    );
  }

  return (
    <section className="settings-section">
      <h3 className="settings-h">Sync across devices</h3>
      {body}
      {msg && <p className={msg.bad ? "form-error" : "form-ok"} role="status">{msg.text}</p>}
    </section>
  );
}

/** View-only links to your cookbook or a recipe. */
function ShareSection({ recipes }: { recipes: Recipe[] }) {
  const signedIn = Boolean(getSession());
  const [title, setTitle] = useState(getShareTitle());
  const [shares, setShares] = useState<Share[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);

  const refresh = () =>
    listShares()
      .then((s) => { setShares(s); setSetupNeeded(false); })
      .catch((e) => { setShares([]); if (/shares|does not exist|Could not find the table/i.test(String(e?.message))) setSetupNeeded(true); });
  useEffect(() => {
    if (signedIn) refresh();
  }, [signedIn]);

  const send = async (url: string, what: string) => {
    const res = await sendLink(url, title);
    if (res === "copied") setMsg({ text: `Link copied. Anyone with it can view ${what}, but not change anything.` });
    if (res === "failed") setMsg({ text: "Couldn't copy automatically. Select the link below and copy it.", bad: true });
  };

  if (!signedIn)
    return (
      <section className="settings-section">
        <h3 className="settings-h">Share your cookbook</h3>
        <p className="muted small">Turn on sync above, then you can share a view-only link to your cookbook or any recipe.</p>
      </section>
    );

  const nameOf = (id: string | null) => (id ? recipes.find((r) => r.id === id)?.name ?? "A recipe (since deleted)" : "Whole cookbook");
  return (
    <section className="settings-section">
      <h3 className="settings-h">Share your cookbook</h3>
      <p className="muted small">Send a link and they can see your recipes, but not change anything. You can turn a link off any time. To share one recipe, use <strong>Share</strong> on its page.</p>
      <label className="field">
        <span className="field-label">Name people will see</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => setShareTitle(title)} maxLength={80} />
      </label>
      <button
        className="btn btn-primary btn-sm"
        disabled={busy}
        onClick={async () => {
          setShareTitle(title);
          setBusy(true);
          setMsg(null);
          try {
            const url = await makeShareLink(null);
            await refresh();
            await send(url, "your cookbook");
          } catch (e) {
            const m = String((e as Error)?.message);
            if (/shares|does not exist|Could not find the table/i.test(m)) setSetupNeeded(true);
            else setMsg({ text: "Couldn't make the link right now. Check your connection and try again.", bad: true });
          } finally {
            setBusy(false);
          }
        }}
      >
        <Icon name="share" size={16} /> {busy ? "Making the link…" : "Share a view-only link"}
      </button>
      {setupNeeded && (
        <p className="sync-warn small">Sharing needs one more step in Supabase: run the sharing SQL from Crumb's README in the SQL Editor, then try again.</p>
      )}
      {msg && <p className={msg.bad ? "form-error" : "form-ok"} role="status">{msg.text}</p>}
      {shares && shares.length > 0 && (
        <ul className="share-list">
          {shares.map((s) => {
            const url = shareUrl(s.token, s.recipe_id);
            return (
              <li key={s.token}>
                <div className="share-what">
                  <strong>{nameOf(s.recipe_id)}</strong>
                  <span className="muted small">Shared {new Date(s.created_at).toLocaleDateString([], { day: "numeric", month: "short" })}</span>
                  <input className="share-url" readOnly value={url} onFocus={(e) => (e.target as HTMLInputElement).select()} aria-label="Share link" />
                </div>
                <div className="row gap-xs">
                  <button className="btn btn-outline btn-sm" onClick={() => send(url, s.recipe_id ? "this recipe" : "your cookbook")}>Copy</button>
                  <button className="btn btn-ghost btn-sm" onClick={async () => { await deleteShare(s.token).catch(() => {}); refresh(); setMsg({ text: "That link no longer works." }); }}>Stop sharing</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const KEY_SHARED = "crumb-key-shared";
const keyShared = () => {
  try {
    return localStorage.getItem(KEY_SHARED) === "1";
  } catch {
    return false;
  }
};

/** Optionally keep your Gemini key in your own Supabase so other devices pick it up after signing in. */
function KeyShareToggle() {
  const [on, setOn] = useState(keyShared());
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  if (!getSession()) return null;
  return (
    <section className="settings-section">
      <label className="check-row">
        <input
          type="checkbox"
          checked={on}
          onChange={async (e) => {
            const next = (e.target as HTMLInputElement).checked;
            setNote(null);
            try {
              await setRemoteKey(next ? getGeminiKey() || null : null);
              try { localStorage.setItem(KEY_SHARED, next ? "1" : "0"); } catch {}
              setOn(next);
              setNote({ text: next ? "Your other devices will pick up this key after signing in." : "Key removed from your account. It stays on this device." });
            } catch {
              setNote({ text: "Couldn't save it. Run the latest Crumb SQL file in Supabase, then try again.", bad: true });
            }
          }}
        />
        <span>
          <strong>Use this key on my other devices</strong>
          <span className="muted small"> Saved privately in your own Supabase project.</span>
        </span>
      </label>
      {note && <p className={note.bad ? "form-error" : "form-ok"} role="status">{note.text}</p>}
    </section>
  );
}
