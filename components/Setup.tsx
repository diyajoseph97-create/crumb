import { useEffect, useRef, useState } from "react";
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
    if (!looksLikeKey(key)) return setError("That doesn't look like a Gemini key. They start with “AQ.” (or “AIza” for older keys).");
    setGeminiKey(key.trim());
    onDone();
  }
  return (
    <main className="unlock">
      <form className="unlock-card setup-card" onSubmit={submit}>
        <Doodle name="pot" className="add-doodle" />
        <h1 className="h-display h-md">Welcome to Crumb</h1>
        <p className="muted">Drop in a downloaded Reel and Crumb turns it into a tidy recipe. To read the videos it needs a free Gemini key. This is the only setup.</p>
        <div className="setup-form col gap-sm">
          <KeyField value={key} onChange={(v) => { setKey(v); setError(null); }} />
          {error && <p className="form-error" role="alert">{error}</p>}
          <p className="muted small privacy-note">
            <Icon name="check" size={14} /> Your recipes and key stay in this browser on this laptop.
          </p>
          <button className="btn btn-primary btn-lg block" disabled={!key.trim()}>Open my cookbook</button>
        </div>
        <p className="add-alt">
          No key yet? <button type="button" className="link-btn" onClick={onDone}>Skip, I'll type recipes in</button>
        </p>
      </form>
    </main>
  );
}

/** Settings dialog inside the app. */
export function SettingsPanel({ onClose, onRestored, onKeyChange }: { onClose: () => void; onRestored: () => void; onKeyChange: (k: string) => void }) {
  const [key, setKey] = useState(getGeminiKey());
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function saveKey(e: React.FormEvent) {
    e.preventDefault();
    if (key.trim() && !looksLikeKey(key)) return setMsg({ text: "That doesn't look like a Gemini key. They start with “AQ.” (or “AIza” for older keys).", bad: true });
    setGeminiKey(key.trim());
    onKeyChange(key.trim());
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

      <form className="settings-section col gap-sm" onSubmit={saveKey}>
        <KeyField value={key} onChange={(v) => { setKey(v); setMsg(null); }} />
        <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }}>Save key</button>
      </form>

      <SyncSection />

      <section className="settings-section">
        <h3 className="settings-h">Backup</h3>
        <p className="muted small">
          {getSession()
            ? "Your recipes are synced and kept on this device. A backup file is still a handy safety net (Supabase's free plan has no backups of its own)."
            : "Your recipes live in this browser only. Clearing browser data or switching browsers removes them. Download a backup now and then (keep it in iCloud Drive or Google Drive), and restore it here if you ever need to."}
        </p>
        <div className="row gap-xs wrap">
          <button className="btn btn-primary btn-sm" onClick={async () => { const n = await downloadBackup(); setMsg({ text: `Backup of ${n} ${n === 1 ? "recipe" : "recipes"} downloaded.` }); }}>
            <Icon name="down" size={16} /> Download a backup
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
            <Icon name="up" size={16} /> Restore from backup
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { restore(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      </section>

      <InstallSection />

      {msg && <p className={msg.bad ? "form-error" : "form-ok"} role="status">{msg.text}</p>}
      <div className="settings-extra">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

/** "Share to Crumb" from Instagram needs Crumb installed as an app (Android + Chrome). */
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
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

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
      <form className="col gap-sm" onSubmit={(e) => { e.preventDefault(); const err = setConfig(url, key); if (err) setMsg({ text: err, bad: true }); else { setMsg(null); resetSyncState(); refresh(); } }}>
        <p className="muted small">Keep one cookbook on your phone and laptop. Connect your Supabase project (Project Settings → API Keys).</p>
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Project URL (https://….supabase.co)" aria-label="Supabase project URL" autoComplete="off" spellCheck={false} />
        <input className="input" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Publishable key (sb_publishable_…)" aria-label="Supabase publishable key" autoComplete="off" spellCheck={false} />
        <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }} disabled={!url.trim() || !key.trim()}>Connect</button>
      </form>
    );
  } else if (!session) {
    body = (
      <div className="col gap-sm">
        {!sent ? (
          <form className="col gap-sm" onSubmit={(e) => { e.preventDefault(); run(async () => { await sendSignInEmail(email); setSent(true); }); }}>
            <p className="muted small">Sign in with your email. Use the same email on each device.</p>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email" autoComplete="email" />
            <button className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }} disabled={busy || !/.+@.+\..+/.test(email)}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
          </form>
        ) : (
          <form className="col gap-sm" onSubmit={(e) => { e.preventDefault(); run(async () => { await verifyCode(email, code); refresh(); syncNow(); }); }}>
            <p className="muted small">Check <strong>{email}</strong>. Tap the link in the email on this device, or type the code from it here.</p>
            <input className="input" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Code from the email" aria-label="Sign-in code" autoComplete="one-time-code" />
            <div className="row gap-xs wrap">
              <button className="btn btn-primary btn-sm" disabled={busy || code.length < 6}>{busy ? "Checking…" : "Sign in"}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSent(false); setCode(""); }}>Use a different email</button>
            </div>
          </form>
        )}
        <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => { clearConfig(); resetSyncState(); refresh(); }}>Change Supabase project</button>
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
