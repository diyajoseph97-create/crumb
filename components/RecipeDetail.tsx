// Recipe page. Left (stays put while you scroll): what the dish is — name,
// who made it, a facts box, Start cooking and the photo. Right: how to make it —
// ingredients (with servings and units together), steps, healthier swaps, notes.
import { isYouTube } from "@/lib/recipe-utils";
import { resizeImage } from "@/lib/image";
import { convertLine, nativeUnits } from "@/lib/units";
import { addToList, getList, isOnList, onListChange, removeFromList } from "@/lib/shopping";
import { CookMode, Stars } from "./CookMode";
import type { ImportJob } from "@/lib/importer";
import { useEffect, useMemo, useState } from "react";
import type { Recipe } from "@/lib/types";
import { formatMinutes, missingParts, isIncomplete, totalIsPartial, totalMinutes } from "@/lib/recipe-utils";
import { scaleFactor, scaleLine, splitIngredient } from "@/lib/scale";
import { ConfirmDialog, Icon, Modal, PixelIcon, Stamp, dietIcon, useViewOnly } from "./ui";
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
  /** Save changes made right on the page (notes, collections, cooked, rating). */
  onUpdate?: (patch: Partial<Recipe>) => void;
  /** Save a photo picked for a recipe that has none. */
  onSetPhoto?: (dataUrl: string) => void;
  /** Make and send a view-only link to this recipe. */
  onShare?: () => void;
  /** Fetch healthier-swap ideas if this recipe doesn't have any yet. */
  ensureTips?: (r: Recipe) => Promise<"ok" | "failed" | "skip">;
};

function ReelLink({ url, onSetLink }: { url: string | null; onSetLink: (url: string) => Promise<string | null> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const viewOnly = useViewOnly().on;
  if (url) {
    return (
      <a className="reel-link" href={url} target="_blank" rel="noopener noreferrer">
        Watch ↗
      </a>
    );
  }
  if (viewOnly) return null;
  if (!editing) {
    return (
      <button className="reel-link add" onClick={() => setEditing(true)}>
        Add the Reel or YouTube link
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

export function RecipeDetail({ recipe: r, onBack, onEdit, onDelete, onFavourite, onAddScreenshots, onSetLink, fillJob, onRetryFill, hasKey, ensureTips, onShare, onSetPhoto, onUpdate }: Props) {
  const view = useViewOnly();
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
  // Grams / Cups. A recipe opens in the one it was written in, which shows the original amounts untouched.
  const native = useMemo(() => nativeUnits(r.ingredients.map((i) => i.original)), [r.id]);
  const [units, setUnits] = useState<"metric" | "us">(native);
  useEffect(() => setUnits(native), [native]);
  const [cooking, setCooking] = useState(false);
  const [onList, setOnList] = useState(isOnList(r.id));
  useEffect(() => {
    setOnList(isOnList(r.id));
    const off = onListChange(() => setOnList(isOnList(r.id)));
    return () => { off(); };
  }, [r.id]);
  const [confirm, setConfirm] = useState(false);
  const factor = r.servings ? scaleFactor(r.servings, servings) : 1;
  const lines = r.ingredients.map((i) => {
    const scaled = scaleLine(i.original, factor);
    return { ...i, scaled, shown: convertLine(scaled.text, units === native ? "as-written" : units) };
  });
  const servingsLabel = r.servings ? `For ${servings} ${servings === 1 ? "person" : "people"}` : "Servings not given";
  const [picking, setPicking] = useState(false);
  /** Add the chosen ingredients (the ones you don't already have) to the shopping list. */
  function addPicked(keep: boolean[]) {
    const chosen = lines.filter((_, i) => keep[i]);
    if (!chosen.length) return removeFromList(r.id);
    addToList({ id: r.id, name: r.name, servings: r.servings ? servings : null, lines: chosen.map((l) => ({ text: l.shown, canonical: l.canonical })) });
  }
  // Only point out amounts that can't scale when the servings have actually been changed.
  const changed = factor !== 1;
  const unscalable = changed ? lines.filter((l) => l.scaled.status === "unscalable").length : 0;
  const total = totalMinutes(r);
  const missing = missingParts(r);
  const incomplete = isIncomplete(r);
  const n = r.nutrition;
  const hasNutrition = n && Object.values(n).some((v) => v != null);
  const stepServings = (d: number) => setServings((s) => Math.max(1, Math.min(50, s + d)));
  const cuisines = r.cuisines.length > 1 ? r.cuisines.filter((c) => c !== "Indian") : r.cuisines;
  // The cuisine; if there isn't one, the meal (e.g. "Desserts").
  const categories = cuisines.length ? cuisines : r.meals.slice(0, 1);
  const cooked = r.cookedCount ?? 0;
  const stampText = r.tags.length ? r.tags.slice(0, 3).join(" · ") : r.cuisines.filter((c) => c !== "Indian")[0] ?? r.cuisines[0] ?? "";

  return (
    <article className="rp">
      {(!view.singleRecipe || view.on) && (
        <div className="rp-top">
          {!view.singleRecipe ? <button className="rp-back" onClick={onBack} aria-label="Back to all recipes">← All recipes</button> : <span />}
          {view.on && <span className="rp-viewonly">View only</span>}
        </div>
      )}

      {fillJob ? (
        <section className="notice">
          {fillJob.status === "adding" ? (
            <>
              <h2 className="notice-title">Filling in the details<span className="dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></h2>
              <p>This page updates by itself. You can keep browsing.</p>
            </>
          ) : (
            <>
              <h2 className="notice-title">Couldn't fill in the details</h2>
              <p>{fillJob.error}</p>
              <button className="btn btn-primary btn-sm" onClick={() => onRetryFill?.(fillJob)}>Try again</button>
            </>
          )}
        </section>
      ) : incomplete && !view.on && (
        <section className="notice">
          <h2 className="notice-title">A few details need your help.</h2>
          {missing.length > 0 && <p>Missing: {missing.join(", ")}.</p>}
          {r.importNotes && <p className="muted">{r.importNotes}</p>}
          <div className="row gap-sm wrap">
            <button className="btn btn-primary btn-sm" onClick={onEdit}>Fill in the missing bits</button>
            <button className="btn btn-outline btn-sm" onClick={onAddScreenshots}>
              {isYouTube(r.sourceShortcode) ? "Read the YouTube video" : "Add the video or screenshots"}
            </button>
          </div>
        </section>
      )}

      <div className="rp-grid">
        {/* ---------- Left: about the dish (stays put while you scroll) ---------- */}
        <aside className="rp-about">
          <div className={`rp-photo ${r.imageUrl ? "" : "no-photo"}`}>
            <RecipeImage recipe={r} variant="hero" />
            {!view.on && (
              <button className={`fav-btn rp-fav ${r.favourite ? "on" : ""}`} onClick={onFavourite} aria-pressed={r.favourite} aria-label={r.favourite ? "Remove from favourites" : "Add to favourites"} title={r.favourite ? "Remove from favourites" : "Add to favourites"}>
                <Icon name="heart" size={18} filled={r.favourite} />
              </button>
            )}
            {!r.imageUrl && onSetPhoto && !view.on && (
              <label className="btn btn-outline btn-sm add-photo">
                Add a photo
                <input type="file" accept="image/*" hidden onChange={async (e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) onSetPhoto(await resizeImage(f));
                }} />
              </label>
            )}
          </div>
          <div className={`rp-label ${stampText ? "has-stamp" : ""}`}>
            {stampText && <Stamp text={stampText} size={96} className="rp-stamp" icon={dietIcon(r.tags[0])} />}
            {categories.length > 0 && <p className="rp-kicker label">{categories.join(" · ")}</p>}
            <h1 className="rp-title px">{r.name || "Untitled recipe"}</h1>
          </div>
          <div className="rp-byline">
            <p className="rp-by">
              {r.creator && <><span className="rp-creator">{r.creator.startsWith("@") || r.creator.includes(" ") ? r.creator : `@${r.creator}`}</span>{r.sourceUrl ? " · " : ""}</>}
              <ReelLink url={r.sourceUrl} onSetLink={onSetLink} />
            </p>
            <div className="rp-tools">
              {!view.on && <button className="icon-btn" onClick={onEdit} aria-label="Edit recipe" title="Edit recipe"><Icon name="edit" size={19} /></button>}
              {!view.on && <button className="icon-btn danger" onClick={() => setConfirm(true)} aria-label="Delete recipe" title="Delete recipe"><Icon name="trash" size={19} /></button>}
              {!view.on && onShare && <button className="icon-btn" onClick={onShare} aria-label="Share a view-only link" title="Share a view-only link"><Icon name="share" size={19} /></button>}
            </div>
          </div>

          <dl className="facts">
            <div className="facts-row facts-3">
              <div><dt className="label"><PixelIcon name="pot" />Prep</dt><dd>{est(r.timesEstimated, r.prepMinutes)}{formatMinutes(r.prepMinutes)}</dd></div>
              <div><dt className="label"><PixelIcon name="flame" />Cook</dt><dd>{est(r.timesEstimated, r.cookMinutes)}{formatMinutes(r.cookMinutes)}</dd></div>
              <div><dt className="label"><PixelIcon name="clock" />Total</dt><dd>{total != null ? <>{est(r.timesEstimated, total)}{formatMinutes(total)}{totalIsPartial(r) ? "+" : ""}</> : "—"}</dd></div>
            </div>
            {hasNutrition && (
              <div className="facts-row">
                <div>
                  <dt className="label"><PixelIcon name="bowl" />Per serving, roughly</dt>
                  <dd className="facts-small">
                    {([[n!.calories, " kcal"], [n!.protein, " g protein"], [n!.carbs, " g carbs"], [n!.fat, " g fat"], [n!.fibre, " g fibre"]] as const)
                      .filter(([v]) => v != null).map(([v, u]) => `${v}${u}`).join(" · ")}
                  </dd>
                </div>
              </div>
            )}
            {r.suggestedTags.length > 0 && !view.on && (
              <div className="facts-row">
                <div>
                  <dt className="label">Might also be</dt>
                  <dd className="facts-small facts-soft" title="Suggested, not confirmed yet. Edit the recipe to confirm.">{r.suggestedTags.join(" · ")}</dd>
                </div>
              </div>
            )}
            {cooked > 0 && (
              <div className="facts-row">
                <div>
                  <dt className="label"><PixelIcon name="check" />Made</dt>
                  <dd className="facts-made">
                    {cooked} {cooked === 1 ? "time" : "times"}{r.lastCookedAt ? ` · last ${new Date(r.lastCookedAt).toLocaleDateString([], { day: "numeric", month: "short" })}` : ""}
                    {r.rating ? <Stars value={r.rating} size={14} /> : null}
                  </dd>
                </div>
              </div>
            )}
          </dl>

          <div className="rp-actions">
            <button className="btn btn-primary btn-lg" onClick={() => setCooking(true)}>Start cooking</button>
          </div>

        </aside>

        {/* ---------- Right: how to make it, one flowing column ---------- */}
        <div className="rp-make">
          <section className="rp-section" aria-labelledby="ing-h">
            <div className="rp-h-row">
              <h2 id="ing-h" className="rp-h px">Ingredients:</h2>
              {lines.length > 0 && (
                <button className={`icon-btn cart-btn ${onList ? "on" : ""}`} onClick={() => setPicking(true)} aria-label={onList ? "On your shopping list. Change or remove" : "Add to shopping list"} title={onList ? "On your shopping list" : "Add to shopping list"}>
                  <Icon name={onList ? "cart-check" : "cart-plus"} size={24} />
                </button>
              )}
            </div>
            {lines.length > 0 && (
              <div className="rp-controls">
                {r.servings ? (
                  <div className="serves" role="group" aria-label="Servings">
                    <span>Serves</span>
                    <button className="serves-btn" onClick={() => stepServings(-1)} aria-label="Fewer servings" disabled={servings <= 1}>−</button>
                    <span className="serves-val" aria-live="polite">{servings}</span>
                    <button className="serves-btn" onClick={() => stepServings(1)} aria-label="More servings">+</button>
                    {factor !== 1 && <button className="rp-link small" onClick={() => setServings(r.servings!)}>Reset</button>}
                  </div>
                ) : (
                  <span className="muted small">Add a serving size to scale</span>
                )}
                <div className="units" role="group" aria-label="Units">
                  {([["metric", "Grams"], ["us", "Cups"]] as ["metric" | "us", string][]).map(([u, label]) => (
                    <button key={u} className={units === u ? "on" : ""} aria-pressed={units === u} onClick={() => setUnits(u)}>{label}</button>
                  ))}
                </div>
              </div>
            )}
            {lines.length === 0 ? (
              <p className="muted">No ingredients yet.</p>
            ) : (
              <ul className="ing-list">
                {lines.map((l) => {
                  const { qty, name } = splitIngredient(l.shown);
                  return (
                    <li key={l.id} className={`${l.scaled.status === "scaled" ? "is-scaled" : ""} ${changed && l.scaled.status === "unscalable" ? "is-unscaled" : ""}`}>
                      <span className="ing-qty">{qty.replace(/\s+(g|kg|ml|l|cl)\b/i, " $1") || "–"}</span>
                      <span className="ing-name">
                        {name}
                        {changed && l.scaled.status === "unscalable" && <span className="unscaled" title="Couldn't read this amount reliably, so it's shown as originally written">not scaled</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {unscalable > 0 && <p className="muted small">Marked amounts don't scale exactly. Adjust them to taste.</p>}
          </section>

          <section className="rp-section" aria-labelledby="steps-h">
            <h2 id="steps-h" className="rp-h px">Instructions:</h2>
            {r.steps.length === 0 ? (
              <p className="muted">No steps yet.</p>
            ) : (
              <ol className="step-list">
                {r.steps.map((s, i) => (
                  <li key={i}>
                    <span className="step-no px"><span className="sr-only">Step </span>{i + 1}.</span>
                    <span className="step-text">{s}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {(!view.on || r.healthTips?.length) && (
            <section className="rp-block" aria-labelledby="healthy-h">
              <h3 id="healthy-h" className="rp-h3 px">Make it healthier:</h3>
              {r.healthTips?.length ? (
                <ul className="tips">{r.healthTips.map((t, i) => <li key={i}>{t}</li>)}</ul>
              ) : r.ingredients.length === 0 ? (
                <p className="muted">Add the ingredients and you'll get a few healthier swaps here.</p>
              ) : !hasKey ? (
                <p className="muted">Add your key in Settings to get a few healthier swaps here.</p>
              ) : tipsState === "failed" ? (
                <p className="muted">Couldn't come up with swaps just now. Open this recipe again later.</p>
              ) : (
                <p className="muted">Thinking up some healthier swaps<span className="dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></p>
              )}
            </section>
          )}
          {!view.on && onUpdate && <MyNotes value={r.myNotes ?? ""} onSave={(t) => onUpdate({ myNotes: t.trim() || null })} />}
        </div>
      </div>

      <Modal open={picking} onClose={() => setPicking(false)} label="Add to shopping list" variant="sheet">
        {picking && <ShopPicker recipeId={r.id} lines={lines.map((l) => l.shown)} onList={onList} onDone={(keep) => { if (keep) addPicked(keep); else removeFromList(r.id); setPicking(false); }} onClose={() => setPicking(false)} />}
      </Modal>
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
      {cooking && (
        <CookMode
          recipe={r}
          lines={lines.map((l) => l.shown)}
          servingsLabel={servingsLabel}
          onClose={() => setCooking(false)}
          onCooked={!view.on && onUpdate ? (rating) => onUpdate({ cookedCount: (r.cookedCount ?? 0) + 1, lastCookedAt: new Date().toISOString(), ...(rating ? { rating } : {}) }) : undefined}
        />
      )}
    </article>
  );
}

/** Your own notes on a recipe (kept off shared links). Saves when you click away. */
function MyNotes({ value, onSave }: { value: string; onSave: (t: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <section className="rp-block" aria-labelledby="my-notes-h">
      <h3 id="my-notes-h" className="rp-h3 px">My notes:</h3>
      <textarea
        className="my-notes-input"
        value={text}
        placeholder="Used half the chilli? Doubled the garlic? Note it here."
        rows={4}
        onChange={(e) => setText((e.target as HTMLTextAreaElement).value)}
        onBlur={() => text !== value && onSave(text)}
        aria-label="My notes"
      />
    </section>
  );
}


/** Untick what you already have; the rest goes on the shopping list. */
function ShopPicker({ recipeId, lines, onList, onDone, onClose }: { recipeId: string; lines: string[]; onList: boolean; onDone: (keep: boolean[] | null) => void; onClose: () => void }) {
  const current = getList().recipes.find((x) => x.id === recipeId);
  const [keep, setKeep] = useState<boolean[]>(() => lines.map((l) => (current ? current.lines.some((c) => c.text === l) : true)));
  const n = keep.filter(Boolean).length;
  return (
    <div className="shop shop-pick">
      <div className="sheet-head">
        <span className="sheet-grip" aria-hidden="true" />
        <h2 className="h-display h-sm">Add to shopping list</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
      </div>
      <div className="sheet-body">
        <p className="muted small">Untick anything you already have.</p>
        <div className="row gap-sm">
          <button className="rp-link small u" onClick={() => setKeep(lines.map(() => true))}>Select all</button>
          <button className="rp-link small u" onClick={() => setKeep(lines.map(() => false))}>Select none</button>
        </div>
        <ul className="shop-items">
          {lines.map((l, i) => (
            <li key={i}>
              <button className={`cook-ing ${keep[i] ? "on" : ""}`} aria-pressed={keep[i]} onClick={() => setKeep((k) => k.map((v, j) => (j === i ? !v : v)))}>
                <span className="cook-check">{keep[i] && <Icon name="check" size={14} />}</span>
                <span className="shop-name">{l}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="sheet-foot">
        {onList ? <button className="btn btn-ghost" onClick={() => onDone(null)}>Remove from list</button> : <span />}
        <button className="btn btn-primary" onClick={() => onDone(keep)} disabled={n === 0 && !onList}>
          <Icon name="cart" size={16} /> {n === 0 ? "Remove from list" : onList ? `Update list (${n})` : `Add ${n} ${n === 1 ? "item" : "items"}`}
        </button>
      </div>
    </div>
  );
}
