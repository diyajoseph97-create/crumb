"use client";
import { useEffect, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import { verifySettings, type Settings } from "@/lib/github";
import { appBaseUrl, joinLink, lockSettings, unlockSettings } from "@/lib/device-link";
import { bookmarkletCode } from "@/lib/bookmarklet";
import { Doodle, Icon, Logo } from "./ui";

/** Drag-to-bookmarks-bar button. React won't render javascript: links, so the address is set directly. */
function BookmarkButton() {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    ref.current?.setAttribute("href", bookmarkletCode(appBaseUrl()));
  }, []);
  return (
    <a ref={ref} className="bookmarklet" draggable onClick={(e) => e.preventDefault()} title="Drag me to your bookmarks bar">
      <Icon name="plus" size={16} /> Save to Crumb
    </a>
  );
}

function AddDevice({ settings }: { settings: Settings }) {
  const [pin, setPin] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function make(e: React.FormEvent) {
    e.preventDefault();
    if (pin.trim().length < 6) return;
    setBusy(true);
    setLink(joinLink(await lockSettings(settings, pin.trim())));
    setBusy(false);
  }

  if (link) {
    const qr = qrcode(0, "M");
    qr.addData(link);
    qr.make();
    return (
      <div className="add-device">
        <div className="qr" dangerouslySetInnerHTML={{ __html: qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) }} />
        <div className="col gap-xs grow">
          <p className="small">Scan this, or open the link on your other device, then enter your PIN there.</p>
          <div className="row gap-xs wrap">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true)).catch(() => {})}
            >
              <Icon name={copied ? "check" : "link"} size={14} /> {copied ? "Copied" : "Copy link"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setLink(null); setPin(""); setCopied(false); }}>Done</button>
          </div>
          <p className="muted small">The link only works with your PIN. Don't send the PIN in the same message.</p>
        </div>
      </div>
    );
  }
  return (
    <form className="row gap-xs wrap add-device-form" onSubmit={make}>
      <input className="input grow" type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Choose a PIN (6+ characters)" aria-label="PIN" autoComplete="new-password" />
      <button className="btn btn-outline" disabled={busy || pin.trim().length < 6}>{busy ? "Locking…" : "Create link"}</button>
    </form>
  );
}

/** First-run screen when opened from an "Add another device" link. */
function JoinWithPin({ payload, onConnect, onManual }: { payload: string; onConnect: (s: Settings) => void; onManual: () => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const s = await unlockSettings(payload, pin.trim());
    if (!s) {
      setBusy(false);
      return setError("That PIN didn't unlock the link. Check it and try again.");
    }
    const problem = await verifySettings(s);
    setBusy(false);
    if (problem) return setError(problem);
    onConnect(s);
  }
  return (
    <form className="col gap-sm setup-form" onSubmit={submit}>
      <label className="field">
        <span className="field-label">PIN from your other device</span>
        <input className="input input-lg" type="password" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus autoComplete="off" />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-lg block" disabled={busy || !pin.trim()}>{busy ? "Unlocking…" : "Open my cookbook"}</button>
      <p className="add-alt"><button type="button" className="link-btn" onClick={onManual}>Set up with keys instead</button></p>
    </form>
  );
}

type Props = {
  initial?: Partial<Settings>;
  /** From an "Add another device" link (#join=…). */
  joinPayload?: string | null;
  /** Shown inside the app's Settings dialog rather than as the first-run screen. */
  inApp?: boolean;
  onConnect: (s: Settings) => void;
  onDemo?: () => void;
  onDisconnect?: () => void;
  onExport?: () => void;
  onCancel?: () => void;
};

export const DEFAULT_REPO = "crumb-data";

export function Setup({ initial, joinPayload, inApp, onConnect, onDemo, onDisconnect, onExport, onCancel }: Props) {
  const [manual, setManual] = useState(!joinPayload);
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
        {initial?.token && (
          <>
            <section className="settings-section">
              <h3 className="settings-h">Save from Instagram</h3>
              <p className="muted small">Drag this button to your bookmarks bar. On a Reel on instagram.com, click it and Crumb opens with the link and caption filled in. (Bookmarks bar hidden? Press <kbd>⌘</kbd><kbd>⇧</kbd><kbd>B</kbd> or <kbd>Ctrl</kbd><kbd>⇧</kbd><kbd>B</kbd>.)</p>
              <BookmarkButton />
            </section>
            <section className="settings-section">
              <h3 className="settings-h">Add another device</h3>
              <p className="muted small">Make a PIN-locked link, so another laptop or phone can connect without copying keys.</p>
              <AddDevice settings={initial as Settings} />
            </section>
            <h3 className="settings-h">Keys</h3>
          </>
        )}
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
        <h1 className="h-display h-md">{joinPayload && !manual ? "Connect this device" : "Connect your cookbook"}</h1>
        <p className="muted">
          {joinPayload && !manual
            ? "Enter the PIN you chose on your other device."
            : "One-time setup on each device. Your recipes are saved in your own private GitHub repo."}
        </p>
        {joinPayload && !manual ? <JoinWithPin payload={joinPayload} onConnect={onConnect} onManual={() => setManual(true)} /> : form}
        {onDemo && (
          <p className="add-alt">
            Just looking? <button className="link-btn" onClick={onDemo}>Try it with sample recipes</button>
          </p>
        )}
      </div>
    </main>
  );
}
