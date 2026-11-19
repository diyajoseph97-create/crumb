import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ImportResult, Recipe } from "@/lib/types";
import type { Store } from "@/lib/store";
import { fetchReelPreview } from "@/lib/reel";
import { saveLater } from "@/lib/importer";
import { canonicalInstagramUrl, emptyDraft, instagramShortcode, isSavedForLater, isYouTube, SOURCE_LINK } from "@/lib/recipe-utils";
import type { ImportInput } from "@/lib/importer";
import { Doodle, Dropdown, Icon, Modal } from "./ui";

type Props = {
  open: boolean;
  onClose: () => void;
  store: Store;
  recipes: Recipe[];
  geminiKey: string | null;
  /** When set, the material fills in this existing recipe instead of creating one. */
  fillRecipe: Recipe | null;
  onSaved: (r: Recipe) => void;
  onOpenRecipe: (id: string) => void;
  onTypeIn: () => void;
  onOpenSettings: () => void;
  /** Hand the recipe over to be added in the background. */
  onQueue: (input: ImportInput) => void;
  /** Small message at the bottom of the screen. */
  notify: (text: string, action?: { label: string; run: () => void }) => void;
  /** Something shared from the phone's share menu: prefill, then read it (video) or save it for later (link only). */
  shared?: { url: string; caption: string; files: File[] } | null;
};

export const IG_LINK = SOURCE_LINK;

type Phase = { kind: "form" } | { kind: "done"; result: ImportResult };
type Picked = { file: File; preview: string | null };

const MAX_IMAGES = 8;

export function AddRecipeModal({ open, onClose, store, recipes, geminiKey, fillRecipe: fillProp, onSaved, onOpenRecipe, onTypeIn, onOpenSettings, shared, onQueue, notify }: Props) {
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<Picked[]>([]);
  const [caption, setCaption] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [auto, setAuto] = useState<"read" | "later" | null>(null);
  // A video for one of the "Saved for later" Reels fills that one in, instead of making a new recipe.
  const saved = recipes.filter(isSavedForLater).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [target, setTarget] = useState<string>("new");
  // "From link" or "From screenshots" (screenshots or a screen recording).
  const [mode, setMode] = useState<"link" | "shots">("link");
  const fillRecipe = fillProp ?? (target !== "new" ? saved.find((r) => r.id === target) ?? null : null);

  // Reset before the window is shown, so nothing typed straight away is wiped.
  useLayoutEffect(() => {
    if (!open) return;
    setPhase({ kind: "form" });
    setError(null);
    setFiles([]);
    setUrl(shared?.url || "");
    setCaption(shared?.caption || "");
    setAuto(null);
    setTarget("new");
    setMode(shared?.files.length ? "shots" : "link");
    if (shared) {
      if (shared.files.length) {
        const dt = new DataTransfer();
        shared.files.forEach((f) => dt.items.add(f));
        addFiles(dt.files);
        if (!shared.url && saved.length) setTarget(saved[0].id); // ask which saved Reel; don't start yet
        else if (geminiKey) setAuto("read");
        else setError("To add recipes from videos, add your key in Settings first.");
      } else if (shared.url && instagramShortcode(shared.url)) {
        setAuto(geminiKey ? "read" : "later");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shared]);

  // Shared from the phone: start straight away once the form is filled in.
  useEffect(() => {
    if (!auto) return;
    if (auto === "read" && files.length === 0 && !ytUrl && !code) return;
    const run = auto;
    setAuto(null);
    if (run === "read") submit();
    else saveForLater();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, files, url]);

  /** Anything typed or pasted into the box: pull out the Instagram link, keep the rest as caption. */
  function onSmartText(text: string) {
    const m = text.match(IG_LINK);
    if (m && !fillRecipe) {
      setUrl(m[0]);
      text = text.replace(m[0], "").replace(/^\s+/, "");
    }
    setCaption(text);
  }

  function onPaste(e: React.ClipboardEvent) {
    const pasted = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (pasted.length) {
      e.preventDefault();
      const dt = new DataTransfer();
      pasted.forEach((f) => dt.items.add(f));
      addFiles(dt.files);
    }
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const incoming = [...list].filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (incoming.length) setMode("shots");
    setFiles((cur) => {
      let next = [...cur];
      for (const f of incoming) {
        if (f.type.startsWith("video/")) next = next.filter((x) => !x.file.type.startsWith("video/")); // one video at a time
        next.push({ file: f, preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null });
      }
      const video = next.filter((x) => x.file.type.startsWith("video/"));
      const images = next.filter((x) => x.file.type.startsWith("image/")).slice(0, MAX_IMAGES);
      return [...video, ...images];
    });
  }

  const code = url.trim() ? instagramShortcode(url) : null;
  // A public YouTube video can be read from its link alone.
  const ytUrl = code && isYouTube(code) ? canonicalInstagramUrl(code) : fillRecipe && isYouTube(fillRecipe.sourceShortcode) ? fillRecipe.sourceUrl : null;
  const hasMaterial = files.length > 0 || caption.trim().length > 0 || Boolean(fillRecipe?.originalCaption) || Boolean(ytUrl);

  /** Keep the link (and caption, if pasted) now; read the recipe later from the inbox. */
  async function saveForLater() {
    setError(null);
    if (!code) return;
    const existing = recipes.find((r) => r.sourceShortcode === code);
    if (existing) return setPhase({ kind: "done", result: { status: "duplicate", recipe: existing } });
    try {
      if (!isYouTube(code)) {
        const preview = await fetchReelPreview(code).catch(() => null);
        const recipe = await saveLater({ files: [], caption, code, fillId: null }, store, preview);
        onSaved(recipe);
        onClose();
        notify("Saved for later. Add your key in Settings and crumbs can read the recipe from the caption.");
        return;
      }
      const recipe = await store.create({
        ...emptyDraft(),
        name: isYouTube(code) ? "Recipe from YouTube" : "Recipe from Instagram",
        sourceUrl: canonicalInstagramUrl(code),
        sourceShortcode: code,
        originalCaption: caption.trim() || null,
        importNotes: isYouTube(code)
          ? "Saved for later. Tap “Read it” and crumbs watches the YouTube video for you."
          : "Instagram only shared the link. Download the Reel (⋯ → Download in Instagram), then tap “Add the video or screenshots” and pick it.",
      });
      onSaved(recipe);
      onClose();
      notify(isYouTube(code) ? "Saved for later" : "Saved for later. Add the downloaded Reel when you're ready.");
    } catch (err) {
      setError((err as Error).message || "Couldn't save it.");
    }
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (url.trim() && !code) {
      setError("That doesn't look like an Instagram Reel or YouTube link. It should look like instagram.com/reel/… or youtube.com/watch?v=…");
      return;
    }
    if (code && !fillRecipe) {
      const existing = recipes.find((r) => r.sourceShortcode === code);
      if (existing) {
        setPhase({ kind: "done", result: { status: "duplicate", recipe: existing } });
        return;
      }
    }
    // No key: keep the link for later. (With a key, an Instagram link alone is enough:
    // crumbs reads the Reel's caption, and saves it for later if the recipe isn't there.)
    if (code && !fillRecipe && !geminiKey) return saveForLater();
    if (!hasMaterial && !code) {
      setError("Paste a link, or add the downloaded video or screenshots.");
      return;
    }

    if (!geminiKey) {
      setError("To add recipes from videos, add your key in Settings first.");
      return;
    }

    onQueue({ files: files.map((f) => f.file), caption, code: fillRecipe ? null : code, fillId: fillRecipe?.id ?? null });
    onClose();
  }

  const video = files.find((f) => f.file.type.startsWith("video/"));
  const images = files.filter((f) => f.file.type.startsWith("image/"));

  return (
    <Modal open={open} onClose={onClose} label={fillRecipe ? "Fill in the missing bits" : "Add a recipe"}>
      <div className="add">
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">
          <Icon name="x" />
        </button>

        {phase.kind === "form" && (
          <form
            onSubmit={submit}
            className={`col gap-sm ${dragging ? "is-dragging" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          >
            <div className="add-head">
              <Doodle name="pot" className="add-doodle" />
              <h2 className="h-display h-md">{fillRecipe ? "Fill in the missing bits" : "Found something delicious?"}</h2>
              <p className="muted">
                {fillRecipe
                  ? `Add a recording, screenshots or the caption of “${fillRecipe.name}”. crumbs fills in what's missing and keeps what you have.`
                  : "Save it here before it gets lost in your feed."}
              </p>
            </div>

            {!fillRecipe && (
              <div className="seg" role="tablist" aria-label="Add from">
                <button type="button" role="tab" aria-selected={mode === "link"} className={mode === "link" ? "on" : ""} onClick={() => setMode("link")}><Icon name="link" size={16} /> From link</button>
                <button type="button" role="tab" aria-selected={mode === "shots"} className={mode === "shots" ? "on" : ""} onClick={() => setMode("shots")}><Icon name="image" size={16} /> From screenshots</button>
              </div>
            )}

            {!fillProp && saved.length > 0 && files.length > 0 && !url && (
              <div className="field which-reel">
                <span className="field-label" id="which-reel-l">Which Reel is this video from?</span>
                <Dropdown
                  className="dd-field"
                  label="Which Reel is this video from?"
                  value={target}
                  onChange={setTarget}
                  options={[
                    ...saved.map((r) => ({ value: r.id, label: `Saved Reel · ${new Date(r.createdAt).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` })),
                    { value: "new", label: "None of these, make a new recipe" },
                  ]}
                />
                <span className="hint">crumbs fills in the saved Reel and keeps its link.</span>
              </div>
            )}

            {!fillRecipe && mode === "link" && (
              <div className="add-step">
                <span className="add-step-icon" aria-hidden="true"><Icon name="link" size={18} /></span>
                <label className="add-step-body link-field">
                  <span className="add-step-title">Paste the link</span>
                  <span className="add-step-hint">From Instagram or YouTube. That's usually all you need: crumbs reads the caption or the video.</span>
                  <span className={`link-input ${url && !code ? "bad" : ""}`}>
                    <input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value.trim())} placeholder="https://www.instagram.com/reel/…" aria-label="Recipe link" />
                    {code && <Icon name="check" size={16} className="link-ok" />}
                  </span>
                  {url && !code && <span className="hint bad">That doesn't look like an Instagram Reel or YouTube link.</span>}
                </label>
              </div>
            )}

            {(fillRecipe || mode === "shots") && !(fillRecipe && ytUrl) && (
              <div className="add-step">
                <span className="add-step-icon" aria-hidden="true"><Icon name="image" size={18} /></span>
                <div className="add-step-body">
                  <span className="add-step-title">{fillRecipe ? "Add the video or screenshots" : "Add screenshots or a recording"}</span>
                  <span className="add-step-hint">{fillRecipe ? "A recording or screenshots of the recipe." : "Screenshots of the recipe, or a screen recording of the Reel."}</span>
                {!video && (
                  <button type="button" className={`dropzone big ${dragging ? "over" : ""}`} onClick={() => fileRef.current?.click()}>
                    <Icon name="upload" size={22} />
                    <strong>Drop screenshots or a recording here</strong>
                    <span className="muted small">or click to choose</span>
                  </button>
                )}
                {files.length > 0 && (
                  <div className="shots">
                    {video && (
                      <div className="shot shot-video wide">
                        <Icon name="play" size={22} />
                        <span className="shot-name">{video.file.name}</span>
                        <span>{(video.file.size / 1024 / 1024).toFixed(1)} MB</span>
                        <button type="button" className="shot-x" aria-label="Remove video" onClick={() => setFiles((x) => x.filter((f) => f !== video))}>
                          <Icon name="x" size={12} />
                        </button>
                      </div>
                    )}
                    {images.map((f, i) => (
                      <div key={i} className="shot">
                        <img src={f.preview!} alt={`Screenshot ${i + 1}`} />
                        <button type="button" className="shot-x" aria-label="Remove screenshot" onClick={() => setFiles((x) => x.filter((y) => y !== f))}>
                          <Icon name="x" size={12} />
                        </button>
                      </div>
                    ))}
                    <button type="button" className="shot shot-add" onClick={() => fileRef.current?.click()} aria-label="Add more"><Icon name="plus" /></button>
                  </div>
                )}
                </div>
              </div>
            )}

            <div className="add-step">
              <span className="add-step-icon" aria-hidden="true"><Icon name="list" size={18} /></span>
              <div className="add-step-body">
                <span className="add-step-title">{mode === "shots" && !fillRecipe ? "Add the caption" : "Paste the caption"} <span className="add-opt">optional</span></span>
                <span className="add-step-hint">{ytUrl ? "The video's description, if it lists the amounts." : "Most creators put the ingredient amounts here."}</span>
                <textarea
                  className="smart-input"
                  rows={3}
                  value={caption}
                  onChange={(e) => onSmartText(e.target.value)}
                  onPaste={onPaste}
                  placeholder="Paste the caption or recipe text…"
                  aria-label="Paste a link or caption"
                />
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

            {!geminiKey && (files.length > 0 || caption.trim().length > 0) && (
              <p className="form-note">
                Adding recipes from videos needs your key. <button type="button" className="link-btn" onClick={onOpenSettings}>Add it in Settings</button>
              </p>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}

            <div className="add-actions">
              {!fillRecipe && (
                <button type="button" className="btn btn-outline btn-lg" onClick={onTypeIn}>
                  <Icon name="edit" size={18} /> I'll add it manually
                </button>
              )}
              <button type="submit" className="btn btn-primary btn-lg grow">
                <Icon name="plus" size={18} /> {fillRecipe ? "Fill in the missing bits" : "Save to crumbs"}
              </button>
            </div>
          </form>
        )}

        {phase.kind === "done" && (
          <Result
            result={phase.result}
            onOpen={(id) => { onClose(); onOpenRecipe(id); }}
            onClose={onClose}
            onTryAgain={() => setPhase({ kind: "form" })}
          />
        )}
      </div>
    </Modal>
  );
}

function Result({ result, onOpen, onClose }: { result: ImportResult; onOpen: (id: string) => void; onClose: () => void; onTryAgain?: () => void }) {
  if (result.status !== "duplicate") return null;
  return (
    <div className="result">
      <div className="result-badge tone-butter"><Icon name="heart" size={26} filled /></div>
      <h2 className="h-display h-md">Looks like you've already saved this one.</h2>
      <p className="muted">It's in your cookbook as “{result.recipe.name}”.</p>
      <div className="row gap-sm center">
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={() => onOpen(result.recipe.id)}>Open saved recipe</button>
      </div>
    </div>
  );
}
