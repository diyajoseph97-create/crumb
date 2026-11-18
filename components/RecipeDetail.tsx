"use client";
import { useState } from "react";
import type { Recipe } from "@/lib/types";
import { formatMinutes, missingParts, isIncomplete, totalIsPartial, totalMinutes } from "@/lib/recipe-utils";
import { scaleFactor, scaleLine, formatAmount } from "@/lib/scale";
import { MEAL_STYLE } from "@/lib/constants";
import { ConfirmDialog, Doodle, Icon, Sticker } from "./ui";
import { RecipeImage } from "./RecipeImage";

type Props = {
  recipe: Recipe;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFavourite: () => void;
  onAddScreenshots: () => void;
};

const TILTS = [-2, 1.5, -1, 2, -1.5];
const est = (flag: boolean | undefined, v: number | null) => (flag && v != null ? "~" : "");

export function RecipeDetail({ recipe: r, onBack, onEdit, onDelete, onFavourite, onAddScreenshots }: Props) {
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

  return (
    <article className="detail">
      <div className="detail-top">
        <button className="btn btn-ghost back-btn" onClick={onBack}>
          <Icon name="back" size={18} /> All recipes
        </button>
        <div className="row gap-xs">
          <button className="icon-btn lg" onClick={onEdit} aria-label="Edit recipe" title="Edit">
            <Icon name="edit" />
          </button>
          <button className="icon-btn lg" onClick={() => setConfirm(true)} aria-label="Delete recipe" title="Delete">
            <Icon name="trash" />
          </button>
        </div>
      </div>

      <header className="detail-hero">
        <div className="detail-media">
          <RecipeImage recipe={r} variant="hero" />
          <button className={`fav-btn big ${r.favourite ? "on" : ""}`} onClick={onFavourite} aria-pressed={r.favourite} aria-label={r.favourite ? "Remove from favourites" : "Add to favourites"}>
            <Icon name="heart" size={22} filled={r.favourite} />
          </button>
        </div>

        <div className="detail-info">
          <div className="sticker-row">
            {[...r.cuisines, ...r.meals].map((c, i) => (
              <Sticker key={c} tone={r.cuisines.includes(c) ? "cobalt" : MEAL_STYLE[c]?.colour ?? "butter"} tilt={TILTS[i % TILTS.length]}>
                {c}
              </Sticker>
            ))}
          </div>
          <h1 className="h-display h-lg detail-title">{r.name || "Untitled recipe"}</h1>

          <dl className="facts">
            <div><dt>Prep</dt><dd>{est(r.timesEstimated, r.prepMinutes)}{formatMinutes(r.prepMinutes)}</dd></div>
            <div><dt>Cook</dt><dd>{est(r.timesEstimated, r.cookMinutes)}{formatMinutes(r.cookMinutes)}</dd></div>
            <div className="fact-total">
              <dt>Total</dt>
              <dd>{est(r.timesEstimated, total)}{formatMinutes(total)}{total != null && totalIsPartial(r) ? "+" : ""}</dd>
            </div>
            <div><dt>Serves</dt><dd>{est(r.servingsEstimated, r.servings)}{r.servings ?? "—"}</dd></div>
          </dl>
          {(r.timesEstimated || r.servingsEstimated) && (
            <p className="estimate-note">
              <span className="est-badge">~ estimated</span>
              {r.timesEstimated && r.servingsEstimated
                ? "The Reel didn't state the times or servings, so these are AI estimates."
                : r.timesEstimated
                ? "The Reel didn't state the times, so these are AI estimates."
                : "The Reel didn't state the servings, so this is an AI estimate."}
            </p>
          )}

          {(r.tags.length > 0 || r.suggestedTags.length > 0) && (
            <div className="tag-row">
              {r.tags.map((t) => <span key={t} className="tag">{t}</span>)}
              {r.suggestedTags.map((t) => (
                <span key={t} className="tag suggested" title="Suggested by AI, not confirmed yet. Edit the recipe to confirm.">
                  {t}?
                </span>
              ))}
            </div>
          )}

          {r.sourceUrl && (
            <a className="btn btn-cobalt watch-btn" href={r.sourceUrl} target="_blank" rel="noopener noreferrer">
              <Icon name="play" size={20} /> Watch original video <Icon name="external" size={16} />
            </a>
          )}
        </div>
      </header>

      {!incomplete && r.importNotes && <p className="import-note"><Icon name="sparkle" size={14} /> {r.importNotes}</p>}

      {incomplete && (
        <section className="notice notice-warn">
          <Doodle name="sparkle" className="notice-doodle" />
          <div>
            <h2 className="notice-title">This recipe needs a few details</h2>
            {missing.length > 0 && <p>Missing: {missing.join(", ")}.</p>}
            {r.importNotes && <p className="muted">{r.importNotes}</p>}
            <div className="row gap-sm wrap">
              <button className="btn btn-primary btn-sm" onClick={onAddScreenshots}>
                <Icon name="camera" size={16} /> Fill in from screenshots
              </button>
              <button className="btn btn-outline btn-sm" onClick={onEdit}>
                <Icon name="edit" size={16} /> Fill in by hand
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="cook-cols">
        <section className="ingredients" aria-labelledby="ing-h">
          <div className="section-head">
            <h2 id="ing-h" className="h-display h-md">Ingredients</h2>
            {r.servings ? (
              <div className="stepper" role="group" aria-label="Servings">
                <button onClick={() => stepServings(-1)} aria-label="Fewer servings" disabled={servings <= 1}><Icon name="minus" size={16} /></button>
                <span className="stepper-val" aria-live="polite">
                  <strong>{servings}</strong> {servings === 1 ? "serving" : "servings"}
                </span>
                <button onClick={() => stepServings(1)} aria-label="More servings"><Icon name="plus" size={16} /></button>
              </div>
            ) : (
              <span className="muted small">Add a serving size to scale</span>
            )}
          </div>

          {factor !== 1 && (
            <p className="scale-note">
              Scaled ×{formatAmount(factor)} from {r.servings}.{" "}
              <button className="link-btn" onClick={() => setServings(r.servings!)}>Reset</button>
            </p>
          )}

          {lines.length === 0 ? (
            <p className="muted">No ingredients yet.</p>
          ) : (
            <ul className="ing-list">
              {lines.map((l) => (
                <li key={l.id} className={l.scaled.status === "scaled" ? "is-scaled" : ""}>
                  <span className="ing-dot" aria-hidden="true" />
                  <span className="ing-text">{l.scaled.text}</span>
                  {l.scaled.status === "unscalable" && (
                    <span className="unscaled" title="Couldn't read this amount reliably, so it's shown as originally written">
                      not scaled
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {unscalable > 0 && (
            <p className="muted small">
              {unscalable} {unscalable === 1 ? "amount" : "amounts"} couldn't be scaled reliably. Shown as originally written.
            </p>
          )}
        </section>

        <section className="instructions" aria-labelledby="ins-h">
          <h2 id="ins-h" className="h-display h-md">Method</h2>
          {r.steps.length === 0 ? (
            <p className="muted">No steps yet.</p>
          ) : (
            <ol className="steps">
              {r.steps.map((s, i) => (
                <li key={i}>
                  <span className="step-num" aria-hidden="true">{i + 1}</span>
                  <p>{s}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <details className="nutrition">
        <summary>
          <span className="h-display h-sm">Nutrition</span>
          <span className="muted small">{hasNutrition ? "AI estimate, per serving" : "Not available"}</span>
          <Icon name="down" size={18} className="summary-chev" />
        </summary>
        {hasNutrition ? (
          <>
            <dl className="nutri-grid">
              {([
                ["Calories", n!.calories, "kcal"],
                ["Protein", n!.protein, "g"],
                ["Carbs", n!.carbs, "g"],
                ["Fat", n!.fat, "g"],
                ["Fibre", n!.fibre, "g"],
              ] as const).map(([label, v, unit]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{v == null ? "—" : <>~{v}<small>{unit}</small></>}</dd>
                </div>
              ))}
            </dl>
            <p className="muted small">
              These numbers were estimated by AI from the ingredient list. They aren't verified nutritional information.
            </p>
          </>
        ) : (
          <p className="muted small">There wasn't enough information (like ingredient quantities) to estimate nutrition.</p>
        )}
      </details>

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
