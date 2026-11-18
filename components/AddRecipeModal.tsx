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
};

const STEPS = ["Sending to Gemini", "Watching & reading", "Picking a photo", "Saving to your cookbook"];
type Phase = { kind: "form" } | { kind: "working"; step: number } | { kind: "done"; result: ImportResult };
type Picked = { file: File; preview: string | null };

const MAX_IMAGES = 8;

export function AddRecipeModal({ open, onClose, store, recipes, geminiKey, fillRecipe, onSaved, onOpenRecipe, onTypeIn, onOpenSettings }: Props) {
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<Picked[]>([]);
  const [caption, setCaption] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPhase({ kind: "form" });
      setError(null);
      setUrl("");
      setFiles([]);
      setCaption("");
    }
  }, [open]);

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

  const hasMaterial = files.length > 0 || caption.trim().length > 0;
  const code = url.trim() ? instagramShortcode(url) : null;
  const linkOnly = !fillRecipe && !hasMaterial && !!code;

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
    if (!hasMaterial && !linkOnly) {
      setError("Add a screen recording, screenshots, or the caption text.");
      return;
    }

    // Link only: save it now, fill in later.
    if (linkOnly) {
      setPhase({ kind: "working", step: 3 });
      try {
        const recipe = await store.create({
          ...emptyDraft(),
          name: "Recipe from Instagram",
          sourceUrl: canonicalInstagramUrl(code!),
          sourceShortcode: code,
          importNotes: "Saved as a link only. Add a screen recording or screenshots to fill in the recipe.",
        });
        onSaved(recipe);
        setPhase({ kind: "done", result: { status: "saved", recipe } });
      } catch (err) {
        setPhase({ kind: "done", result: { status: "error", message: (err as Error).message } });
      }
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
        text: caption,
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
      const sources = [video ? "video" : "", files.some((f) => f.file.type.startsWith("image/")) ? "screenshots" : "", caption.trim() ? "caption" : ""].filter(Boolean);
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
          <form onSubmit={submit} className="col gap-sm">
            <div className="add-head">
              <Doodle name="pot" className="add-doodle" />
              <h2 className="h-display h-md">{fillRecipe ? "Fill in the gaps" : "Add a recipe"}</h2>
              <p className="muted">
                {fillRecipe
                  ? `Add a screen recording or screenshots of “${fillRecipe.name}”. Crumb fills in what's missing and keeps what you have.`
                  : "Share the Reel with Crumb and it'll turn it into a tidy recipe card."}
              </p>
            </div>

            {!fillRecipe && (
              <label className="field">
                <span className="field-label">Instagram link</span>
                <input className="input" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/reel/…" />
              </label>
            )}

            <div
              className="dropzone"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
            >
              {files.length === 0 ? (
                <>
                  <Icon name="play" size={28} />
                  <strong>Add a screen recording or screenshots</strong>
                  <span className="muted small">A recording works best: Crumb listens to what's said and reads on-screen text.</span>
                </>
              ) : (
                <div className="shots">
                  {video && (
                    <div className="shot shot-video">
                      <Icon name="play" size={22} />
                      <span>{(video.file.size / 1024 / 1024).toFixed(1)} MB</span>
                      <button type="button" className="shot-x" aria-label="Remove video" onClick={(e) => { e.stopPropagation(); setFiles((x) => x.filter((f) => f !== video)); }}>
                        <Icon name="x" size={12} />
                      </button>
                    </div>
                  )}
                  {images.map((f, i) => (
                    <div key={i} className="shot">
                      <img src={f.preview!} alt={`Screenshot ${i + 1}`} />
                      <button type="button" className="shot-x" aria-label="Remove screenshot" onClick={(e) => { e.stopPropagation(); setFiles((x) => x.filter((y) => y !== f)); }}>
                        <Icon name="x" size={12} />
                      </button>
                    </div>
                  ))}
                  {images.length < MAX_IMAGES && <div className="shot shot-add"><Icon name="plus" /></div>}
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

            <label className="field">
              <span className="field-label">Caption <span className="muted">(optional, paste it if it has the recipe)</span></span>
              <textarea className="input" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Paste the post's caption…" />
            </label>

            <button type="button" className="link-btn help-toggle" onClick={() => setHelp(!help)} aria-expanded={help}>
              {help ? "Hide tips" : "How do I get these from Instagram?"}
            </button>
            {help && (
              <ul className="help-list">
                <li><strong>Link:</strong> on the Reel, tap <em>Share</em> (paper plane) then <em>Copy link</em>.</li>
                <li><strong>Screen recording:</strong> iPhone: Control Centre → Screen Recording. Android: Quick Settings → Screen record. Let the Reel play with sound on, then stop.</li>
                <li><strong>Caption:</strong> tap <em>more</em> under the Reel, then press and hold the text to copy it.</li>
              </ul>
            )}

            {!geminiKey && hasMaterial && (
              <p className="form-note">
                Reading recordings needs your Gemini key. <button type="button" className="link-btn" onClick={onOpenSettings}>Add it in Settings</button>
              </p>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary btn-lg block" disabled={!hasMaterial && !linkOnly}>
              {linkOnly ? <><Icon name="link" size={18} /> Save link for later</> : <><Icon name="sparkle" size={18} /> {fillRecipe ? "Fill in recipe" : "Read recipe"}</>}
            </button>

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
