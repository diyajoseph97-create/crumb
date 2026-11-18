"use client";
import { useState } from "react";
import { verifySettings, type Settings } from "@/lib/github";
import { Doodle, Icon, Logo } from "./ui";

type Props = {
  initial?: Partial<Settings>;
  /** Shown inside the app's Settings dialog rather than as the first-run screen. */
  inApp?: boolean;
  onConnect: (s: Settings) => void;
  onDemo?: () => void;
  onDisconnect?: () => void;
  onExport?: () => void;
  onCancel?: () => void;
};

export const DEFAULT_REPO = "crumb-data";

export function Setup({ initial, inApp, onConnect, onDemo, onDisconnect, onExport, onCancel }: Props) {
  const [repo, setRepo] = useState(initial?.owner ? `${initial.owner}/${initial.repo}` : `diyajoseph97-create/${DEFAULT_REPO}`);
  const [token, setToken] = useState(initial?.token ?? "");
  const [gemini, setGemini] = useState(initial?.geminiKey ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const [owner, name] = repo.trim().replace(/^https?:\/\/github\.com\//, "").split("/");
    if (!owner || !name) return setError("Enter the recipes repo as owner/name, e.g. yourname/crumb-data.");
    if (!token.trim()) return setError("Paste your GitHub access token.");
    const s: Settings = { owner, repo: name, token: token.trim(), geminiKey: gemini.trim() };
    setBusy(true);
    setError(null);
    const problem = await verifySettings(s);
    setBusy(false);
    if (problem) return setError(problem);
    onConnect(s);
  }

  const form = (
    <form className="col gap-sm setup-form" onSubmit={submit}>
      <label className="field">
        <span className="field-label">Recipes repo (private)</span>
        <input className="input" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="yourname/crumb-data" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      </label>
      <label className="field">
        <span className="field-label">GitHub access token</span>
        <input className="input" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" autoComplete="off" />
        <span className="hint">Fine-grained token with access to only the recipes repo, and Contents: Read and write.</span>
      </label>
      <label className="field">
        <span className="field-label">Gemini API key <span className="muted">(for reading Reels)</span></span>
        <input className="input" type="password" value={gemini} onChange={(e) => setGemini(e.target.value)} placeholder="AIza…" autoComplete="off" />
        <span className="hint">From aistudio.google.com. You can add this later.</span>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="muted small privacy-note">
        <Icon name="check" size={14} /> These stay on this device only. They're never added to Crumb's public code.
      </p>
      <button className="btn btn-primary btn-lg block" disabled={busy}>
        {busy ? "Checking…" : inApp ? "Save" : "Open my cookbook"}
      </button>
    </form>
  );

  if (inApp) {
    return (
      <div className="settings">
        <h2 className="h-display h-md">Settings</h2>
        {form}
        <div className="settings-extra">
          {onExport && (
            <button className="btn btn-outline btn-sm" onClick={onExport}>
              <Icon name="down" size={16} /> Download a backup
            </button>
          )}
          {onDisconnect && (
            <button className="btn btn-ghost btn-sm" onClick={onDisconnect}>
              Disconnect this device
            </button>
          )}
          {onCancel && <button className="btn btn-ghost btn-sm" onClick={onCancel}>Close</button>}
        </div>
      </div>
    );
  }

  return (
    <main className="unlock">
      <div className="unlock-card setup-card">
        <Logo />
        <Doodle name="pot" className="add-doodle" />
        <h1 className="h-display h-md">Connect your cookbook</h1>
        <p className="muted">One-time setup on each device. Your recipes are saved in your own private GitHub repo.</p>
        {form}
        {onDemo && (
          <p className="add-alt">
            Just looking? <button className="link-btn" onClick={onDemo}>Try it with sample recipes</button>
          </p>
        )}
      </div>
    </main>
  );
}
