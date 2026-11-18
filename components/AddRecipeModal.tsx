"use client";
import { useEffect, useRef, useState } from "react";
import type { ImportResult, Recipe, RecipeDraft } from "@/lib/types";
import type { Store } from "@/lib/store";
import { canonicalInstagramUrl, emptyDraft, instagramShortcode, isIncomplete } from "@/lib/recipe-utils";
import { mergeIntoExisting, readRecipe } from "@/lib/gemini";
import { captureFrame } from "@/lib/video-frame";
import { Doodle, Icon, Modal } from "./ui";

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
  /** Filled in by the "Save to Crumb" bookmark button. */
  initialUrl?: string;
  initialCaption?: string;
};

const IG_LINK = /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p|tv)\/[A-Za-z0-9_-]+\/?(?:\?[^\s]*)?/i;

const STEPS = ["Sending to Gemini", "Watching & reading", "Picking a photo", "Saving to your cookbook"];
type Phase = { kind: "form" } | { kind: "working"; step: number } | { kind: "done"; result: ImportResult };
type Picked = { file: File; preview: string | null };

const MAX_IMAGES = 8;

export function AddRecipeModal({ open, onClose, store, recipes, geminiKey, fillRecipe, onSaved, onOpenRecipe, onTypeIn, onOpenSettings, initialUrl, initialCaption }: Props) {
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<Picked[]>([]);
  const [caption, setCaption] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [fromClipboard, setFromClipboard] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPhase({ kind: "form" });
    setError(null);
    setFiles([]);
    setFromClipboard(false);
    setUrl(initialUrl ?? "");
    setCaption(initialCaption ?? "");
    // Just copied a Reel link? Fill it in. (The browser may ask permission the first time.)
    if (!initialUrl && !fillRecipe && navigator.clipboard?.readText) {
      navigator.clipboard
        .readText()
        .then((t) => {
          const m = t.match(IG_LINK);
          if (m) {
            setUrl((cur) => cur || m[0]);
            setFromClipboard(true);
          }
        })
        .catch(() => {});
    }
  }, [open, initialUrl, initialCaption, fillRecipe]);

  /** Anything typed or pasted into the box: pull out the Instagram link, keep the rest as caption. */
  function onSmartText(text: string) {
    const m = text.match(IG_LINK);
    if (m && !fillRecipe) {
      setUrl(m[0]);
      setFromClipboard(false);
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

  const hasMaterial = files.length > 0 || caption.trim().length > 0 || Boolean(fillRecipe?.originalCaption);
  const code = url.trim() ? instagramShortcode(url) : null;

  /** Keep the link (and caption, if pasted) now; read the recipe later from the inbox. */
  async function saveForLater() {
    setError(null);
    if (!code) return;
    const existing = recipes.find((r) => r.sourceShortcode === code);
    if (existing) return setPhase({ kind: "done", result: { status: "duplicate", recipe: existing } });
    setPhase({ kind: "working", step: 3 });
    try {
      const recipe = await store.create({
        ...emptyDraft(),
        name: "Recipe from Instagram",
        sourceUrl: canonicalInstagramUrl(code),
        sourceShortcode: code,
        originalCaption: caption.trim() || null,
        importNotes: "Saved for later. Open it from “Saved for later” to read the recipe.",
      });
      onSaved(recipe);
      setPhase({ kind: "done", result: { status: "later", recipe } });
    } catch (err) {
      setPhase({ kind: "done", result: { status: "error", message: (err as Error).message } });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (url.trim() && !code) {
      setError("That doesn't look like an Instagram Reel or post link. It should look like instagram.com/reel/…");
      return;
    }
    if (code && !fillRecipe) {
      const existing = recipes.find((r) => r.sourceShortcode === code);
      if (existing) {
        setPhase({ kind: "done", result: { status: "duplicate", recipe: existing } });
        return;
      }
    }
    if (!hasMaterial) {
      setError("Paste the caption, or add a screen recording or screenshots.");
      return;
    }

    if (!geminiKey) {
      setError("To read recipes automatically, add your Gemini key in Settings first.");
      return;
    }

    setPhase({ kind: "working", step: 0 });
    try {
      const result = await readRecipe({
        apiKey: geminiKey,
        files: files.map((f) => f.file),
        text: caption.trim() || fillRecipe?.originalCaption || "",
        existing: fillRecipe ?? undefined,
        onStage: (s) => setPhase({ kind: "working", step: s === "upload" ? 0 : 1 }),
      });
      if (!result.isRecipe && !fillRecipe) {
        setPhase({ kind: "done", result: { status: "error", message: "Gemini couldn't find a recipe in that. Try a recording or screenshots that show the ingredients and method." } });
        return;
      }

      // Photo: a frame of the finished dish from the video, if there is one.
      setPhase({ kind: "working", step: 2 });
      const video = files.find((f) => f.file.type.startsWith("video/"))?.file;
      let imageUrl: string | null = null;
      if (video && result.heroFrameSeconds != null && !fillRecipe?.imageUrl) {
        const frame = await captureFrame(video, result.heroFrameSeconds);
        if (frame) imageUrl = await store.uploadImage(frame).catch(() => null);
      }

      setPhase({ kind: "working", step: 3 });
      const usedCaption = caption.trim() || fillRecipe?.originalCaption;
      const sources = [video ? "video" : "", files.some((f) => f.file.type.startsWith("image/")) ? "screenshots" : "", usedCaption ? "caption" : ""].filter(Boolean);
      const readFrom = `Read from the ${sources.join(", ").replace(/, ([^,]*)$/, " and $1")}.`;
      const notes = [result.notes, readFrom].filter(Boolean).join(" ");

      let recipe: Recipe;
      if (fillRecipe) {
        const patch = mergeIntoExisting(fillRecipe, result.draft);
        if (imageUrl) patch.imageUrl = imageUrl;
        patch.importNotes = notes;
        if (caption.trim() && !fillRecipe.originalCaption) patch.originalCaption = caption.trim();
        recipe = await store.update(fillRecipe.id, patch);
      } else {
        const draft: RecipeDraft = {
          ...emptyDraft(),
          ...result.draft,
          name: result.draft.name || "Untitled recipe",
          imageUrl,
          sourceUrl: code ? canonicalInstagramUrl(code) : null,
          sourceShortcode: code,
          originalCaption: caption.trim() || null,
          importNotes: notes,
        };
        recipe = await store.create(draft);
      }
      onSaved(recipe);
      setPhase({ kind: "done", result: { status: "saved", recipe } });
    } catch (err) {
      setPhase({ kind: "done", result: { status: "error", message: (err as Error).message || "Something went wrong." } });
    }
  }

  const working = phase.kind === "working";
  const video = files.find((f) => f.file.type.startsWith("video/"));
  const images = files.filter((f) => f.file.type.startsWith("image/"));

  return (
    <Modal open={open} onClose={working ? () => {} : onClose} label={fillRecipe ? "Fill in recipe" : "Add a recipe"}>
      <div className="add">
        {!working && (
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        )}

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
              <h2 className="h-display h-md">{fillRecipe ? "Fill in the gaps" : "Add a recipe"}</h2>
              <p className="muted">
                {fillRecipe
                  ? `Add a recording, screenshots or the caption of “${fillRecipe.name}”. Crumb fills in what's missing and keeps what you have.`
                  : "Paste the Reel link and caption, or drop a recording or screenshots. Anything works."}
              </p>
            </div>

            {url && !fillRecipe && (
              <div className={`link-chip ${code ? "" : "bad"}`}>
                <Icon name="link" size={16} />
                <span className="link-chip-text">{code ? `Instagram Reel · ${code}` : url}</span>
                {fromClipboard && <span className="chip-note">from your clipboard</span>}
                <button type="button" className="icon-btn sm" onClick={() => { setUrl(""); setFromClipboard(false); }} aria-label="Remove link">
                  <Icon name="x" size={14} />
                </button>
              </div>
            )}

            <div className="smartzone">
              <textarea
                className="smart-input"
                rows={files.length ? 3 : 5}
                value={caption}
                onChange={(e) => onSmartText(e.target.value)}
                onPaste={onPaste}
                placeholder={fillRecipe ? "Paste the caption or recipe text…" : "Paste the Reel link and its caption here…\n\nYou can also paste screenshots, or drop a screen recording anywhere."}
                aria-label="Paste a link, caption or screenshots"
                autoFocus
              />
              {files.length > 0 && (
                <div className="shots">
                  {video && (
                    <div className="shot shot-video">
                      <Icon name="play" size={22} />
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
                </div>
              )}
              <div className="smartzone-bar">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                  <Icon name="play" size={16} /> Add recording or screenshots
                </button>
                <button type="button" className="link-btn" onClick={() => setHelp(!help)} aria-expanded={help}>
                  {help ? "Hide tips" : "Tips"}
                </button>
              </div>
              {dragging && <div className="drop-overlay"><Icon name="plus" size={28} /> Drop to add</div>}
            </div>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

            {help && (
              <ul className="help-list">
                <li><strong>Fastest:</strong> on instagram.com, click the <em>Save to Crumb</em> button in your bookmarks bar. The link and caption come with it. (Set it up in Settings.)</li>
                <li><strong>Recipe only in the video?</strong> Screen-record it playing with sound: Mac <kbd>⌘</kbd><kbd>⇧</kbd><kbd>5</kbd>, Windows <kbd>Win</kbd><kbd>Alt</kbd><kbd>R</kbd>. Then drop the file here.</li>
                <li><strong>No time now?</strong> Paste just the link and choose <em>Save for later</em>.</li>
              </ul>
            )}

            {!geminiKey && hasMaterial && (
              <p className="form-note">
                Reading recipes needs your Gemini key. <button type="button" className="link-btn" onClick={onOpenSettings}>Add it in Settings</button>
              </p>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}

            <div className="add-actions">
              {code && !fillRecipe && (
                <button type="button" className={`btn ${hasMaterial ? "btn-outline" : "btn-primary"} btn-lg`} onClick={saveForLater}>
                  <Icon name="link" size={18} /> Save for later
                </button>
              )}
              {(hasMaterial || !code || fillRecipe) && (
                <button type="submit" className="btn btn-primary btn-lg grow" disabled={!hasMaterial}>
                  <Icon name="sparkle" size={18} /> {fillRecipe ? "Fill in recipe" : "Read recipe"}
                </button>
              )}
            </div>

            {!fillRecipe && (
              <p className="add-alt">
                Rather type it? <button type="button" className="link-btn" onClick={onTypeIn}>Add it by hand</button>
              </p>
            )}
          </form>
        )}

        {phase.kind === "working" && (
          <div className="working" aria-live="polite">
            <div className="spinner-pot">
              <Doodle name="pot" className="pot-bob" />
              <span className="steam s1" /><span className="steam s2" /><span className="steam s3" />
            </div>
            <h2 className="h-display h-md">Cooking up your recipe…</h2>
            <ol className="progress-steps">
              {STEPS.map((s, i) => (
                <li key={s} className={i < phase.step ? "done" : i === phase.step ? "now" : ""}>
                  <span className="pdot">{i < phase.step ? <Icon name="check" size={12} /> : null}</span>
                  {s}
                </li>
              ))}
            </ol>
            <p className="muted small">A minute-long recording usually takes 20–60 seconds. Keep this open.</p>
          </div>
        )}

        {phase.kind === "done" && (
          <Result
            result={phase.result}
            filling={!!fillRecipe}
            onOpen={(id) => { onClose(); onOpenRecipe(id); }}
            onClose={onClose}
            onTryAgain={() => setPhase({ kind: "form" })}
          />
        )}
      </div>
    </Modal>
  );
}

function Result({ result, filling, onOpen, onClose, onTryAgain }: {
  result: ImportResult; filling: boolean; onOpen: (id: string) => void; onClose: () => void; onTryAgain: () => void;
}) {
  if (result.status === "duplicate") {
    return (
      <div className="result">
        <div className="result-badge tone-butter"><Icon name="heart" size={26} filled /></div>
        <h2 className="h-display h-md">Already in your cookbook!</h2>
        <p className="muted">You saved “{result.recipe.name}” from this Reel before, so Crumb didn't add a second copy.</p>
        <div className="row gap-sm center">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => onOpen(result.recipe.id)}>Open recipe</button>
        </div>
      </div>
    );
  }
  if (result.status === "error") {
    return (
      <div className="result">
        <div className="result-badge tone-tomato"><Icon name="alert" size={26} /></div>
        <h2 className="h-display h-md">That didn't quite work</h2>
        <p className="muted">{result.message}</p>
        <div className="row gap-sm center wrap">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={onTryAgain}>Try again</button>
        </div>
      </div>
    );
  }
  if (result.status === "later") {
    return (
      <div className="result">
        <div className="result-badge tone-butter pop"><Icon name="link" size={26} /></div>
        <h2 className="h-display h-md">Saved for later</h2>
        <p className="muted">It's waiting in <strong>Saved for later</strong> at the top of your cookbook. Open it when you're ready to read the recipe.</p>
        <div className="row gap-sm center">
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    );
  }
  const incomplete = isIncomplete(result.recipe);
  return (
    <div className="result">
      <div className={`result-badge ${incomplete ? "tone-tangerine" : "tone-cobalt"} pop`}><Icon name={incomplete ? "pen" : "check"} size={26} /></div>
      <h2 className="h-display h-md">{incomplete ? "Saved, with a few gaps" : filling ? "All filled in!" : "Saved to your cookbook!"}</h2>
      <p className="muted">
        {incomplete
          ? `“${result.recipe.name}” is saved. Some details weren't in what Crumb was given, and nothing has been guessed. You can fill them in from the recipe page.`
          : `“${result.recipe.name}” is ready to cook.`}
      </p>
      <div className="row gap-sm center">
        <button className="btn btn-ghost" onClick={onClose}>Done</button>
        <button className="btn btn-primary" onClick={() => onOpen(result.recipe.id)}>View recipe</button>
      </div>
    </div>
  );
}
