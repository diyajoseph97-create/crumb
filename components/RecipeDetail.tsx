"use client";
import { useState } from "react";
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
};

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

  const categories = [...r.cuisines, ...r.meals];

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

      {incomplete && (
        <section className="notice notice-warn">
          <Doodle name="sparkle" className="notice-doodle" />
          <div>
            <h2 className="notice-title">This recipe needs a few details</h2>
            {missing.length > 0 && <p>Missing: {missing.join(", ")}.</p>}
            {r.importNotes && <p className="muted">{r.importNotes}</p>}
            <div className="row gap-sm wrap">
              <button className="btn btn-primary btn-sm" onClick={onAddScreenshots}>
                <Icon name="play" size={16} /> Fill in from a video or screenshots
              </button>
              <button className="btn btn-outline btn-sm" onClick={onEdit}>
                <Icon name="edit" size={16} /> Fill in by hand
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="recipe-top">
        <div className="recipe-intro">
          {categories.length > 0 && <p className="cat-line">{categories.join("  ·  ")}</p>}
          <h1 className="h-pixel detail-title">{r.name || "Untitled recipe"}</h1>

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
                ? "The Reel didn't state the times or servings."
                : r.timesEstimated
                ? "The Reel didn't state the times."
                : "The Reel didn't state the servings."}
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

          <div className="intro-actions">
            {r.sourceUrl && (
              <a className="btn btn-primary watch-btn" href={r.sourceUrl} target="_blank" rel="noopener noreferrer">
                <Icon name="play" size={18} /> Watch original video <Icon name="external" size={15} />
              </a>
            )}
            <button className={`btn btn-outline fav-toggle ${r.favourite ? "on" : ""}`} onClick={onFavourite} aria-pressed={r.favourite}>
              <Icon name="heart" size={17} filled={r.favourite} /> {r.favourite ? "Favourite" : "Add to favourites"}
            </button>
          </div>
          {!incomplete && r.importNotes && <p className="import-note"><Icon name="sparkle" size={14} /> {r.importNotes}</p>}
        </div>

        <section className="ingredients" aria-labelledby="ing-h">
          <div className="section-head">
            <h2 id="ing-h" className="h-pixel h-md">Ingredients:</h2>
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
            <ul className="ing-grid">
              {lines.map((l) => {
                const { qty, name } = splitIngredient(l.scaled.text);
                return (
                  <li key={l.id} className={l.scaled.status === "scaled" ? "is-scaled" : ""}>
                    <span className="ing-name">{name}</span>
                    <span className="ing-qty">
                      {qty}
                      {l.scaled.status === "unscalable" && (
                        <span className="unscaled" title="Couldn't read this amount reliably, so it's shown as originally written">
                          not scaled
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {unscalable > 0 && (
            <p className="muted small">
              {unscalable} {unscalable === 1 ? "amount" : "amounts"} couldn't be scaled reliably. Shown as originally written.
            </p>
          )}
        </section>
      </section>

      <hr className="rule" />

      <section className="recipe-bottom">
        <div className="detail-media">
          <RecipeImage recipe={r} variant="hero" />
        </div>
        <section className="instructions" aria-labelledby="ins-h">
          <h2 id="ins-h" className="h-pixel h-md">Instructions:</h2>
          {r.steps.length === 0 ? (
            <p className="muted">No steps yet.</p>
          ) : (
            <ol className={`steps ${r.steps.length > 3 ? "two-col" : ""}`}>
              {r.steps.map((s, i) => (
                <li key={i}>
                  <span className="step-num" aria-hidden="true">{i + 1}.</span>
                  <p>{s}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </section>

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
