"use client";
import { useRef, useState } from "react";
import { downloadBackup, getGeminiKey, restoreBackup, setGeminiKey } from "@/lib/local-store";
import { Doodle, Icon, Logo } from "./ui";

function KeyField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span className="field-label">Gemini API key</span>
      <input className="input" type="password" value={value} onChange={(e) => onChange(e.target.value)} placeholder="AIza…" autoComplete="off" spellCheck={false} />
      <span className="hint">
        Free from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a>: sign in, then click <em>Create API key</em> and copy it.
      </span>
    </label>
  );
}

const looksLikeKey = (k: string) => /^AIza[\w-]{20,}$/.test(k.trim());

/** First visit: just the Gemini key (or skip). */
export function Welcome({ onDone }: { onDone: () => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!looksLikeKey(key)) return setError("That doesn't look like a Gemini key. They start with “AIza”.");
    setGeminiKey(key.trim());
    onDone();
  }
  return (
    <main className="unlock">
      <form className="unlock-card setup-card" onSubmit={submit}>
        <Logo />
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
    if (key.trim() && !looksLikeKey(key)) return setMsg({ text: "That doesn't look like a Gemini key. They start with “AIza”.", bad: true });
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
      <h2 className="h-display h-md">Settings</h2>

      <form className="settings-section col gap-sm" onSubmit={saveKey}>
        <KeyField value={key} onChange={(v) => { setKey(v); setMsg(null); }} />
        <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }}>Save key</button>
      </form>

      <section className="settings-section">
        <h3 className="settings-h">Backup</h3>
        <p className="muted small">
          Your recipes live in this browser only. Clearing browser data or switching browsers removes them. Download a backup now and then (keep it in iCloud Drive or Google Drive), and restore it here if you ever need to.
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

      {msg && <p className={msg.bad ? "form-error" : "form-ok"} role="status">{msg.text}</p>}
      <div className="settings-extra">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
