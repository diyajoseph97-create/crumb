"use client";
import { useEffect, useRef, useState } from "react";
import type { ImportResult, Recipe } from "@/lib/types";
import type { Store } from "@/lib/store";
import { instagramShortcode, isIncomplete } from "@/lib/recipe-utils";
import { resizeImage } from "@/lib/image";
import { Doodle, Icon, Modal } from "./ui";

export type AddMode = "link" | "screenshots";

type Props = {
  open: boolean;
  onClose: () => void;
  store: Store;
  recipes: Recipe[];
  /** When set, screenshots fill in this existing recipe instead of creating one. */
  fillRecipe: Recipe | null;
  initialMode: AddMode;
  onSaved: (r: Recipe) => void;
  onOpenRecipe: (id: string) => void;
  onTypeIn: () => void;
};

const LINK_STEPS = ["Fetching the Reel", "Reading the caption", "Watching the video", "Tidying up ingredients", "Saving to your cookbook"];
const SHOT_STEPS = ["Uploading screenshots", "Reading the recipe", "Tidying up ingredients", "Saving to your cookbook"];

type Phase = { kind: "form" } | { kind: "working"; step: number } | { kind: "done"; result: ImportResult };

export function AddRecipeModal({ open, onClose, store, recipes, fillRecipe, initialMode, onSaved, onOpenRecipe, onTypeIn }: Props) {
  const [mode, setMode] = useState<AddMode>(initialMode);
  const [url, setUrl] = useState("");
  const [shots, setShots] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setPhase({ kind: "form" });
      setError(null);
      setUrl("");
      setShots([]);
      setCaption("");
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [open, initialMode]);

  const steps = mode === "link" ? LINK_STEPS : SHOT_STEPS;

  // Progress is shown step by step while the server works.
  function startProgress() {
    setPhase({ kind: "working", step: 0 });
    timer.current = setInterval(() => {
      setPhase((p) => (p.kind === "working" && p.step < steps.length - 2 ? { kind: "working", step: p.step + 1 } : p));
    }, mode === "link" ? 6000 : 2500);
  }
  function finish(result: ImportResult) {
    if (timer.current) clearInterval(timer.current);
    if (result.status === "saved") onSaved(result.recipe);
    setPhase({ kind: "done", result });
  }

  async function importLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = instagramShortcode(url);
    if (!code) {
      setError("That doesn't look like an Instagram Reel or post link. It should start with instagram.com/reel/… or /p/…");
      return;
    }
    // Quick check here, and the server checks again.
    const existing = recipes.find((r) => r.sourceShortcode === code);
    if (existing) {
      setPhase({ kind: "done", result: { status: "duplicate", recipe: existing } });
      return;
    }
    startProgress();
    try {
      finish(await store.importUrl(url.trim()));
    } catch (err) {
      finish({ status: "error", message: err instanceof Error ? err.message : "Import failed." });
    }
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    try {
      const resized = await Promise.all([...files].slice(0, 6 - shots.length).map((f) => resizeImage(f, 1568, 0.85)));
      setShots((s) => [...s, ...resized].slice(0, 6));
    } catch {
      setError("One of those files couldn't be read as an image.");
    }
  }

  async function readShots(e: React.FormEvent) {
    e.preventDefault();
    if (shots.length === 0 && !caption.trim()) {
      setError("Add at least one screenshot, or paste the caption text.");
      return;
    }
    setError(null);
    startProgress();
    try {
      finish(
        await store.extract({
          images: shots,
          text: caption.trim() || undefined,
          sourceUrl: fillRecipe?.sourceUrl ?? (url.trim() || undefined),
          recipeId: fillRecipe?.id,
        })
      );
    } catch (err) {
      finish({ status: "error", message: err instanceof Error ? err.message : "Couldn't read the screenshots." });
    }
  }

  const working = phase.kind === "working";

  return (
    <Modal open={open} onClose={working ? () => {} : onClose} label={fillRecipe ? "Fill in recipe" : "Add a recipe"}>
      <div className="add">
        {!working && (
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        )}

        {phase.kind === "form" && (
          <>
            <div className="add-head">
              <Doodle name="pot" className="add-doodle" />
              <h2 className="h-display h-md">{fillRecipe ? "Fill in the gaps" : "Add a recipe"}</h2>
              <p className="muted">
                {fillRecipe
                  ? `Add screenshots of “${fillRecipe.name}” and Crumb will fill in what's missing, keeping everything you already have.`
                  : "Paste a Reel link and Crumb will turn it into a tidy recipe card."}
              </p>
            </div>

            {!fillRecipe && (
              <div className="tabs" role="tablist">
                <button role="tab" aria-selected={mode === "link"} className={mode === "link" ? "on" : ""} onClick={() => setMode("link")}>
                  <Icon name="link" size={16} /> Instagram link
                </button>
                <button role="tab" aria-selected={mode === "screenshots"} className={mode === "screenshots" ? "on" : ""} onClick={() => setMode("screenshots")}>
                  <Icon name="camera" size={16} /> Screenshots
                </button>
              </div>
            )}

            {mode === "link" && !fillRecipe && (
              <form onSubmit={importLink} className="col gap-sm">
                <label className="field">
                  <span className="field-label">Instagram Reel link</span>
                  <input className="input input-lg" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/reel/…" autoFocus />
                </label>
                {error && <p className="form-error" role="alert">{error}</p>}
                <button type="submit" className="btn btn-primary btn-lg block" disabled={!url.trim()}>
                  <Icon name="sparkle" size={18} /> Import recipe
                </button>
              </form>
            )}

            {(mode === "screenshots" || fillRecipe) && (
              <form onSubmit={readShots} className="col gap-sm">
                <div
                  className="dropzone"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
                >
                  {shots.length === 0 ? (
                    <>
                      <Icon name="camera" size={28} />
                      <strong>Add screenshots</strong>
                      <span className="muted small">Caption, ingredient list, method. Up to 6 images.</span>
                    </>
                  ) : (
                    <div className="shots">
                      {shots.map((s, i) => (
                        <div key={i} className="shot">
                          <img src={s} alt={`Screenshot ${i + 1}`} />
                          <button type="button" className="shot-x" aria-label="Remove screenshot" onClick={(e) => { e.stopPropagation(); setShots((x) => x.filter((_, j) => j !== i)); }}>
                            <Icon name="x" size={12} />
                          </button>
                        </div>
                      ))}
                      {shots.length < 6 && <div className="shot shot-add"><Icon name="plus" /></div>}
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                <label className="field">
                  <span className="field-label">Or paste the caption text <span className="muted">(optional)</span></span>
                  <textarea className="input" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Paste the recipe text from the post…" />
                </label>
                {!fillRecipe && (
                  <label className="field">
                    <span className="field-label">Instagram link <span className="muted">(optional, for "Watch original")</span></span>
                    <input className="input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/reel/…" />
                  </label>
                )}
                {error && <p className="form-error" role="alert">{error}</p>}
                <button type="submit" className="btn btn-primary btn-lg block">
                  <Icon name="sparkle" size={18} /> {fillRecipe ? "Fill in recipe" : "Read recipe"}
                </button>
              </form>
            )}

            {!fillRecipe && (
              <p className="add-alt">
                No link or screenshots? <button className="link-btn" onClick={onTypeIn}>Type it in yourself</button>
              </p>
            )}
          </>
        )}

        {phase.kind === "working" && (
          <div className="working" aria-live="polite">
            <div className="spinner-pot">
              <Doodle name="pot" className="pot-bob" />
              <span className="steam s1" /><span className="steam s2" /><span className="steam s3" />
            </div>
            <h2 className="h-display h-md">Cooking up your recipe…</h2>
            <ol className="progress-steps">
              {steps.map((s, i) => (
                <li key={s} className={i < phase.step ? "done" : i === phase.step ? "now" : ""}>
                  <span className="pdot">{i < phase.step ? <Icon name="check" size={12} /> : null}</span>
                  {s}
                </li>
              ))}
            </ol>
            <p className="muted small">{mode === "link" ? "This can take up to a minute when Crumb needs to watch the video." : "This usually takes 10–30 seconds."}</p>
          </div>
        )}

        {phase.kind === "done" && <Result result={phase.result} filling={!!fillRecipe} onOpen={(id) => { onClose(); onOpenRecipe(id); }} onRetryScreens={() => { setMode("screenshots"); setPhase({ kind: "form" }); }} onClose={onClose} onTryAgain={() => setPhase({ kind: "form" })} />}
      </div>
    </Modal>
  );
}

function Result({ result, filling, onOpen, onRetryScreens, onClose, onTryAgain }: {
  result: ImportResult; filling: boolean; onOpen: (id: string) => void; onRetryScreens: () => void; onClose: () => void; onTryAgain: () => void;
}) {
  if (result.status === "duplicate") {
    return (
      <div className="result">
        <div className="result-badge tone-butter"><Icon name="heart" size={26} filled /></div>
        <h2 className="h-display h-md">Already in your cookbook!</h2>
        <p className="muted">You saved “{result.recipe.name}” before, so Crumb didn't add a second copy.</p>
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
          <button className="btn btn-ghost" onClick={onTryAgain}>Try again</button>
          {!filling && <button className="btn btn-primary" onClick={onRetryScreens}><Icon name="camera" size={16} /> Use screenshots</button>}
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
          ? `Crumb saved what it could find for “${result.recipe.name}”. Some details were missing from the post, and nothing has been guessed. You can fill them in from the recipe page.`
          : `“${result.recipe.name}” is ready to cook.`}
      </p>
      <div className="row gap-sm center">
        <button className="btn btn-ghost" onClick={onClose}>Done</button>
        <button className="btn btn-primary" onClick={() => onOpen(result.recipe.id)}>View recipe</button>
      </div>
    </div>
  );
}
