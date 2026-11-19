// Recipe page laid out like a printed cookbook spread: graph-paper page,
// ruled boxes, typewriter ingredient list (quantity first), a coloured
// method panel with "STEP 1." labels, and a footer strip with time & servings.
import { isYouTube } from "@/lib/recipe-utils";
import { resizeImage } from "@/lib/image";
import { convertLine, type UnitSystem } from "@/lib/units";
import { addToList, isOnList, onListChange, removeFromList } from "@/lib/shopping";
import { CookMode, Stars } from "./CookMode";
import type { ImportJob } from "@/lib/importer";
import { useEffect, useState } from "react";
import type { Recipe } from "@/lib/types";
import { formatMinutes, missingParts, isIncomplete, totalIsPartial, totalMinutes } from "@/lib/recipe-utils";
import { scaleFactor, scaleLine, formatAmount, splitIngredient } from "@/lib/scale";
import { ConfirmDialog, Doodle, Icon, useViewOnly } from "./ui";
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
  /** Names of all your collections, for suggestions. */
  allCollections?: string[];
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
        <Icon name="play" size={18} /> {isYouTube(url) ? "Watch on YouTube" : "Watch the original Reel"} <Icon name="external" size={15} />
      </a>
    );
  }
  if (viewOnly) return null;
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

export function RecipeDetail({ recipe: r, onBack, onEdit, onDelete, onFavourite, onAddScreenshots, onSetLink, fillJob, onRetryFill, hasKey, ensureTips, onShare, onSetPhoto, onUpdate, allCollections = [] }: Props) {
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
  const [units, setUnitsState] = useState<UnitSystem>(() => {
    try { return (localStorage.getItem("crumb-units") as UnitSystem) || "as-written"; } catch { return "as-written"; }
  });
  const setUnits = (u: UnitSystem) => { setUnitsState(u); try { localStorage.setItem("crumb-units", u); } catch {} };
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
    return { ...i, scaled, shown: convertLine(scaled.text, units) };
  });
  const servingsLabel = r.servings ? `For ${servings} ${servings === 1 ? "person" : "people"}` : "Servings not given";
  function toggleList() {
    if (onList) removeFromList(r.id);
    else addToList({ id: r.id, name: r.name, servings: r.servings ? servings : null, lines: lines.map((l) => ({ text: l.shown, canonical: l.canonical })) });
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
  const categories = [...r.cuisines, ...r.meals];

  return (
    <article className="detail">
      <div className="detail-top">
        {!view.singleRecipe ? (
          <button className="btn btn-ghost back-btn" onClick={onBack}>
            <Icon name="back" size={18} /> All recipes
          </button>
        ) : <span />}
        <div className="row gap-xs wrap end">
          <button className="btn btn-primary btn-sm" onClick={() => setCooking(true)}>
            <Icon name="chef" size={15} /> Start cooking
          </button>
          <button className={`btn btn-outline btn-sm ${onList ? "on-list" : ""}`} onClick={toggleList} aria-pressed={onList}>
            <Icon name={onList ? "check" : "list"} size={15} /> {onList ? "On your list" : "Add to list"}
          </button>
        {view.on ? <span className="view-only-pill">View only</span> : <>
          <button className={`btn btn-outline btn-sm fav-toggle ${r.favourite ? "on" : ""}`} onClick={onFavourite} aria-pressed={r.favourite}>
            <Icon name="heart" size={15} filled={r.favourite} /> {r.favourite ? "Favourite" : "Add to favourites"}
          </button>
          {onShare && (
            <button className="btn btn-outline btn-sm" onClick={onShare} title="Share a view-only link">
              <Icon name="share" size={15} /> Share
            </button>
          )}
          <button className="icon-btn lg" onClick={onEdit} aria-label="Edit recipe" title="Edit">
            <Icon name="edit" />
          </button>
          <button className="icon-btn lg" onClick={() => setConfirm(true)} aria-label="Delete recipe" title="Delete">
            <Icon name="trash" />
          </button>
        </>}
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
      ) : incomplete && !view.on && (
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
            {lines.length > 0 && (
              <div className="units" role="group" aria-label="Units">
                {([["as-written", "As written"], ["metric", "Grams & ml"], ["us", "Cups & oz"]] as [UnitSystem, string][]).map(([u, label]) => (
                  <button key={u} className={units === u ? "on" : ""} aria-pressed={units === u} onClick={() => setUnits(u)}>{label}</button>
                ))}
              </div>
            )}
            {lines.length === 0 ? (
              <p className="mag-small mag-pad">No ingredients yet.</p>
            ) : (
              <ul className="mag-ings">
                {lines.map((l) => {
                  const { qty, name } = splitIngredient(l.shown);
                  return (
                    <li key={l.id} className={`${l.scaled.status === "scaled" ? "is-scaled" : ""} ${changed && l.scaled.status === "unscalable" ? "is-unscaled" : ""}`}>
                      <span className="mag-qty">{qty.replace(/\s+(g|kg|ml|l|cl)\b/i, "$1")}</span>
                      <span className="mag-name">
                        {name}
                        {changed && l.scaled.status === "unscalable" && <span className="unscaled" title="Couldn't read this amount reliably, so it's shown as originally written">not scaled</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {unscalable > 0 && <p className="mag-small mag-pad">Highlighted amounts don't scale exactly. Adjust them to taste.</p>}
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
          {(!view.on || r.healthTips?.length) && <section className={`mag-notes ${r.healthTips?.length ? "" : "is-empty"}`} aria-label="Make it healthier">
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
          </section>}
          {!view.on && onUpdate && <MyNotes value={r.myNotes ?? ""} onSave={(t) => onUpdate({ myNotes: t.trim() || null })} />}
        </aside>

        {/* ---------- Right column: photo, title panel, method ---------- */}
        <section className="mag-main">
          <h2 className="mag-head mag-head-main">Recipe</h2>
          <div className={`mag-photo ${r.imageUrl ? "" : "no-photo"}`}>
            <RecipeImage recipe={r} variant="hero" />
            {!r.imageUrl && onSetPhoto && !view.on && (
              <label className="btn btn-outline btn-sm add-photo">
                <Icon name="camera" size={15} /> Add a photo
                <input type="file" accept="image/*" hidden onChange={async (e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) onSetPhoto(await resizeImage(f));
                }} />
              </label>
            )}
          </div>
          <div className="mag-reel">
            <ReelLink url={r.sourceUrl} onSetLink={onSetLink} />
          </div>
          <div className="mag-panel">
            {categories.length > 0 && <p className="mag-cats">{categories.join(" · ")}</p>}
            <h1 className="mag-title">{r.name || "Untitled recipe"}</h1>
            {(!view.on || (r.cookedCount ?? 0) > 0 || (r.collections ?? []).length > 0) && (
              <div className="mag-meta">
                <span className="cooked">
                  {(r.cookedCount ?? 0) > 0
                    ? `Made ${r.cookedCount} ${r.cookedCount === 1 ? "time" : "times"}${r.lastCookedAt ? ` · last ${new Date(r.lastCookedAt).toLocaleDateString([], { day: "numeric", month: "short" })}` : ""}`
                    : "Not made yet"}
                </span>
                <Stars value={r.rating ?? null} onChange={!view.on && onUpdate ? (v) => onUpdate({ rating: v }) : undefined} size={16} />
                {!view.on && onUpdate && (
                  <button className="link-btn" onClick={() => onUpdate({ cookedCount: (r.cookedCount ?? 0) + 1, lastCookedAt: new Date().toISOString() })}>I made this</button>
                )}
              </div>
            )}
            <Collections value={r.collections ?? []} all={allCollections} onChange={!view.on && onUpdate ? (c) => onUpdate({ collections: c }) : undefined} />
            {r.steps.length === 0 ? (
              <p className="mag-steps mag-step-text">No steps yet.</p>
            ) : (
              <ol className="mag-steps">
                {r.steps.map((s, i) => (
                  <li key={i}>
                    <span className="mag-step-label"><span className="sr-only">Step </span>{String(i + 1).padStart(2, "0")}</span> <span className="mag-step-text">{s}</span>
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
    <section className="my-notes" aria-labelledby="my-notes-h">
      <h2 id="my-notes-h" className="mag-head">My notes</h2>
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

/** Your own groups for this recipe, e.g. "Weeknight". */
function Collections({ value, all, onChange }: { value: string[]; all: string[]; onChange?: (c: string[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  if (!onChange && value.length === 0) return null;
  const add = () => {
    const n = name.trim();
    if (n && !value.includes(n)) onChange?.([...value, n]);
    setName("");
    setAdding(false);
  };
  return (
    <div className="collections">
      {value.map((c) => (
        <span key={c} className="coll-chip">
          <Icon name="bookmark" size={12} /> {c}
          {onChange && <button aria-label={`Remove from ${c}`} onClick={() => onChange(value.filter((x) => x !== c))}><Icon name="x" size={11} /></button>}
        </span>
      ))}
      {onChange && (adding ? (
        <form className="coll-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input autoFocus list="coll-list" value={name} onChange={(e) => setName((e.target as HTMLInputElement).value)} onBlur={add} placeholder="e.g. Weeknight" aria-label="Collection name" maxLength={40} />
          <datalist id="coll-list">{all.filter((c) => !value.includes(c)).map((c) => <option key={c} value={c} />)}</datalist>
        </form>
      ) : (
        <button className="coll-chip add" onClick={() => setAdding(true)}><Icon name="plus" size={12} /> {value.length ? "Collection" : "Add to a collection"}</button>
      ))}
    </div>
  );
}
