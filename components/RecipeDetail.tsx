// Recipe page laid out like a printed cookbook spread: graph-paper page,
// ruled boxes, typewriter ingredient list (quantity first), a coloured
// method panel with "STEP 1." labels, and a footer strip with time & servings.
import { isYouTube } from "@/lib/recipe-utils";
import type { ImportJob } from "@/lib/importer";
import { useEffect, useState } from "react";
import type { Recipe } from "@/lib/types";
import { formatMinutes, missingParts, isIncomplete, totalIsPartial, totalMinutes } from "@/lib/recipe-utils";
import { scaleFactor, scaleLine, formatAmount, splitIngredient } from "@/lib/scale";
import { ConfirmDialog, Doodle, Icon } from "./ui";
import { RecipeImage } from "./RecipeImage";

type Props = {
  recipe: Recipe;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFavourite: () => void;
  onAddScreenshots: () => void;
  /** Saves the Instagram link; returns an error message, or null when saved. */
  onSetLink: (url: string) => Promise<string | null>;
  /** Details being filled in in the background, if any. */
  fillJob?: ImportJob | null;
  onRetryFill?: (j: ImportJob) => void;
  hasKey?: boolean;
  /** Fetch healthier-swap ideas if this recipe doesn't have any yet. */
  ensureTips?: (r: Recipe) => Promise<"ok" | "failed" | "skip">;
};

function ReelLink({ url, onSetLink }: { url: string | null; onSetLink: (url: string) => Promise<string | null> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (url) {
    return (
      <a className="reel-link" href={url} target="_blank" rel="noopener noreferrer">
        <Icon name="play" size={18} /> {isYouTube(url) ? "Watch on YouTube" : "Watch the original Reel"} <Icon name="external" size={15} />
      </a>
    );
  }
  if (!editing) {
    return (
      <button className="reel-link add" onClick={() => setEditing(true)}>
        <Icon name="link" size={17} /> Add the Reel or YouTube link
      </button>
    );
  }
  return (
    <form
      className="reel-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const err = await onSetLink(value.trim());
        setBusy(false);
        if (err) setError(err);
        else setEditing(false);
      }}
    >
      <input className="input" type="text" inputMode="url" value={value} onChange={(e) => { setValue(e.target.value); setError(null); }} placeholder="Instagram Reel or YouTube link" autoFocus aria-label="Instagram Reel or YouTube link" />
      <button className="btn btn-primary btn-sm" disabled={busy || !value.trim()}>Save</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}

const est = (flag: boolean | undefined, v: number | null) => (flag && v != null ? "~" : "");

export function RecipeDetail({ recipe: r, onBack, onEdit, onDelete, onFavourite, onAddScreenshots, onSetLink, fillJob, onRetryFill, hasKey, ensureTips }: Props) {
  const [tipsState, setTipsState] = useState<"idle" | "loading" | "failed">("idle");
  useEffect(() => {
    if (!ensureTips || r.healthTips?.length || !hasKey || r.ingredients.length === 0) return;
    let alive = true;
    setTipsState("loading");
    ensureTips(r).then((res) => alive && setTipsState(res === "failed" ? "failed" : "idle"));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id, r.healthTips, hasKey]);
  const [servings, setServings] = useState<number>(r.servings ?? 1);
  const [confirm, setConfirm] = useState(false);
  const factor = r.servings ? scaleFactor(r.servings, servings) : 1;
  const lines = r.ingredients.map((i) => ({ ...i, scaled: scaleLine(i.original, factor) }));
  const unscalable = lines.filter((l) => l.scaled.status === "unscalable").length;
  const total = totalMinutes(r);
  const missing = missingParts(r);
  const incomplete = isIncomplete(r);
  const n = r.nutrition;
  const hasNutrition = n && Object.values(n).some((v) => v != null);
  const stepServings = (d: number) => setServings((s) => Math.max(1, Math.min(50, s + d)));
  const categories = [...r.cuisines, ...r.meals];

  return (
    <article className="detail">
      <div className="detail-top">
        <button className="btn btn-ghost back-btn" onClick={onBack}>
          <Icon name="back" size={18} /> All recipes
        </button>
        <div className="row gap-xs wrap end">
          <button className={`btn btn-outline btn-sm fav-toggle ${r.favourite ? "on" : ""}`} onClick={onFavourite} aria-pressed={r.favourite}>
            <Icon name="heart" size={15} filled={r.favourite} /> {r.favourite ? "Favourite" : "Add to favourites"}
          </button>
          <button className="icon-btn lg" onClick={onEdit} aria-label="Edit recipe" title="Edit">
            <Icon name="edit" />
          </button>
          <button className="icon-btn lg" onClick={() => setConfirm(true)} aria-label="Delete recipe" title="Delete">
            <Icon name="trash" />
          </button>
        </div>
      </div>

      {fillJob ? (
        <section className="notice">
          <Doodle name="sparkle" className="notice-doodle" />
          <div>
            {fillJob.status === "adding" ? (
              <>
                <h2 className="notice-title">Filling in the details<span className="dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></h2>
                <p className="muted">This page updates by itself. You can keep browsing.</p>
              </>
            ) : (
              <>
                <h2 className="notice-title">Couldn't fill in the details</h2>
                <p className="muted">{fillJob.error}</p>
                <button className="btn btn-primary btn-sm" onClick={() => onRetryFill?.(fillJob)}>Try again</button>
              </>
            )}
          </div>
        </section>
      ) : incomplete && (
        <section className="notice notice-warn">
          <Doodle name="sparkle" className="notice-doodle" />
          <div>
            <h2 className="notice-title">We got some of it! A few details need your help.</h2>
            {missing.length > 0 && <p>Missing: {missing.join(", ")}.</p>}
            {r.importNotes && <p className="muted">{r.importNotes}</p>}
            <div className="row gap-sm wrap">
              <button className="btn btn-primary btn-sm" onClick={onEdit}>
                <Icon name="edit" size={16} /> Fill in the missing bits
              </button>
              <button className="btn btn-outline btn-sm" onClick={onAddScreenshots}>
                <Icon name="play" size={16} /> {isYouTube(r.sourceShortcode) ? "Read the YouTube video" : "Add the video or screenshots"}
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="mag">
        {/* ---------- Left column: ingredients, tags & nutrition, notes ---------- */}
        <aside className="mag-side">
          <section className="mag-box" aria-labelledby="ing-h">
            <h2 id="ing-h" className="mag-head">Ingredients</h2>
            <div className="mag-serves">
              {r.servings ? (
                <div className="stepper" role="group" aria-label="Servings">
                  <button onClick={() => stepServings(-1)} aria-label="Fewer servings" disabled={servings <= 1}><Icon name="minus" size={14} /></button>
                  <span className="stepper-val" aria-live="polite">
                    For <strong>{servings}</strong> {servings === 1 ? "person" : "people"}
                  </span>
                  <button onClick={() => stepServings(1)} aria-label="More servings"><Icon name="plus" size={14} /></button>
                </div>
              ) : (
                <span className="mag-small">Add a serving size to scale</span>
              )}
              {factor !== 1 && (
                <button className="mag-reset" onClick={() => setServings(r.servings!)}>
                  ×{formatAmount(factor)} · reset
                </button>
              )}
            </div>
            {lines.length === 0 ? (
              <p className="mag-small mag-pad">No ingredients yet.</p>
            ) : (
              <ul className="mag-ings">
                {lines.map((l) => {
                  const { qty, name } = splitIngredient(l.scaled.text);
                  return (
                    <li key={l.id} className={`${l.scaled.status === "scaled" ? "is-scaled" : ""} ${l.scaled.status === "unscalable" ? "is-unscaled" : ""}`}>
                      <span className="mag-qty">{qty.replace(/\s+(g|kg|ml|l|cl)\b/i, "$1")}</span>
                      <span className="mag-name">
                        {name}
                        {l.scaled.status === "unscalable" && <span className="unscaled" title="Couldn't read this amount reliably, so it's shown as originally written">not scaled</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {unscalable > 0 && <p className="mag-small mag-pad">Highlighted amounts couldn't be scaled reliably.</p>}
          </section>

          {(r.tags.length > 0 || r.suggestedTags.length > 0 || hasNutrition) && (
            <section className="mag-box">
              <h2 className="mag-head">Diet & nutrition</h2>
              <div className="mag-pad">
                {(r.tags.length > 0 || r.suggestedTags.length > 0) && (
                  <div className="tag-row">
                    {r.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                    {r.suggestedTags.map((t) => (
                      <span key={t} className="tag suggested" title="Suggested, not confirmed yet. Edit the recipe to confirm.">{t}?</span>
                    ))}
                  </div>
                )}
                {hasNutrition && (
                  <>
                    <dl className="mag-nutri">
                      {([
                        ["Calories", n!.calories, "kcal"],
                        ["Protein", n!.protein, "g"],
                        ["Carbs", n!.carbs, "g"],
                        ["Fat", n!.fat, "g"],
                        ["Fibre", n!.fibre, "g"],
                      ] as const).map(([label, v, unit]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{v == null ? "—" : `~${v}${unit}`}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mag-small">Per serving · rough estimate.</p>
                  </>
                )}
              </div>
            </section>
          )}

          {/* Like the "my notes" box in a printed cookbook: ideas for a healthier version */}
          <section className={`mag-notes ${r.healthTips?.length ? "" : "is-empty"}`} aria-label="Make it healthier">
            <h2 className="mag-notes-head">Make it healthier</h2>
            {r.healthTips?.length ? (
              <ul className="mag-tips">
                {r.healthTips.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            ) : r.ingredients.length === 0 ? (
              <p>Add the ingredients and you'll get a few healthier swaps here.</p>
            ) : !hasKey ? (
              <p>Add your key in Settings to get a few healthier swaps here.</p>
            ) : tipsState === "failed" ? (
              <p>Couldn't come up with swaps just now. Open this recipe again later.</p>
            ) : (
              <p>Thinking up some healthier swaps<span className="dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></p>
            )}
          </section>
        </aside>

        {/* ---------- Right column: photo, title panel, method ---------- */}
        <section className="mag-main">
          <h2 className="mag-head mag-head-main">Recipe</h2>
          <div className="mag-photo">
            <RecipeImage recipe={r} variant="hero" />
          </div>
          <div className="mag-reel">
            <ReelLink url={r.sourceUrl} onSetLink={onSetLink} />
          </div>
          <div className="mag-panel">
            {categories.length > 0 && <p className="mag-cats">{categories.join(" · ")}</p>}
            <h1 className="mag-title">{r.name || "Untitled recipe"}</h1>
            {r.steps.length === 0 ? (
              <p className="mag-steps mag-step-text">No steps yet.</p>
            ) : (
              <ol className="mag-steps">
                {r.steps.map((s, i) => (
                  <li key={i}>
                    <span className="mag-step-label">Step {i + 1}.</span> <span className="mag-step-text">{s}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        {/* ---------- Footer strip ---------- */}
        <footer className="mag-foot">
          <div><span className="mag-foot-label">Prep</span> {est(r.timesEstimated, r.prepMinutes)}{formatMinutes(r.prepMinutes)}</div>
          <div><span className="mag-foot-label">Cook</span> {est(r.timesEstimated, r.cookMinutes)}{formatMinutes(r.cookMinutes)}</div>
          <div className="mag-foot-total">
            <Icon name="clock" size={16} /> {est(r.timesEstimated, total)}
            {total != null ? formatMinutes(total).replace("min", "minutes") : "Time unknown"}
            {total != null && totalIsPartial(r) ? "+" : ""}
          </div>
          <div className="mag-foot-serves">
            {r.servings ? <>For {est(r.servingsEstimated, r.servings)}{r.servings} {r.servings === 1 ? "person" : "people"}</> : "Servings unknown"}
          </div>
        </footer>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Delete this recipe?"
        body={`“${r.name || "Untitled recipe"}” will be removed from your cookbook. This can't be undone.`}
        confirmLabel="Delete recipe"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          onDelete();
        }}
      />
    </article>
  );
}
