"use client";
import { useRef, useState } from "react";
import type { Ingredient, Nutrition, RecipeDraft } from "@/lib/types";
import { CUISINES, MEALS, TAGS } from "@/lib/constants";
import { canonicalise, displayName, normaliseName } from "@/lib/synonyms";
import { instagramShortcode, newId } from "@/lib/recipe-utils";
import { resizeImage } from "@/lib/image";
import { Icon, ToggleChip } from "./ui";
import { useImageSrc } from "./RecipeImage";

type Props = {
  initial: RecipeDraft;
  title: string;
  onCancel: () => void;
  onSave: (draft: RecipeDraft) => Promise<void>;
  uploadImage: (dataUrl: string) => Promise<string>;
};

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const numOrNull = (v: string) => (v.trim() === "" || isNaN(Number(v)) ? null : Math.max(0, Number(v)));

type IngRow = Ingredient & { autoCanonical: boolean };

export function RecipeEditor({ initial, title, onCancel, onSave, uploadImage }: Props) {
  const [d, setD] = useState<RecipeDraft>(initial);
  const [rows, setRows] = useState<IngRow[]>(
    initial.ingredients.map((i) => ({ ...i, autoCanonical: canonicalise(i.original) === i.canonical }))
  );
  const [steps, setSteps] = useState<string[]>(initial.steps.length ? initial.steps : [""]);
  const [bulk, setBulk] = useState<"" | "ingredients" | "steps">("");
  const [bulkText, setBulkText] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoSrc = useImageSrc(d.imageUrl);

  const set = (patch: Partial<RecipeDraft>) => setD((x) => ({ ...x, ...patch }));
  const n: Nutrition = d.nutrition ?? { calories: null, protein: null, carbs: null, fat: null, fibre: null };

  function updateRow(id: string, original: string) {
    setRows((rs) =>
      rs.map((r) => (r.id === id ? { ...r, original, canonical: r.autoCanonical ? canonicalise(original) : r.canonical } : r))
    );
  }

  function applyBulk() {
    const lines = bulkText
      .split(/\n+/)
      .map((l) => l.replace(/^\s*(?:[-•*▪︎●]|\d+[.)])\s*/, "").trim())
      .filter(Boolean);
    if (bulk === "ingredients") {
      setRows((rs) => [...rs.filter((r) => r.original.trim()), ...lines.map((l) => ({ id: newId(), original: l, canonical: canonicalise(l), autoCanonical: true }))]);
    } else {
      setSteps((ss) => [...ss.filter((s) => s.trim()), ...lines]);
    }
    setBulk("");
    setBulkText("");
  }

  function moveStep(i: number, dir: -1 | 1) {
    setSteps((ss) => {
      const j = i + dir;
      if (j < 0 || j >= ss.length) return ss;
      const copy = [...ss];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  async function onPickImage(file?: File) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const dataUrl = await resizeImage(file);
      const url = await uploadImage(dataUrl);
      set({ imageUrl: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that image.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!d.name.trim()) {
      setError("Give your recipe a name first.");
      return;
    }
    const url = d.sourceUrl?.trim() || null;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...d,
        name: d.name.trim(),
        sourceUrl: url,
        sourceShortcode: url ? instagramShortcode(url) : null,
        ingredients: rows
          .filter((r) => r.original.trim())
          .map(({ autoCanonical, ...r }) => ({ ...r, original: r.original.trim(), canonical: normaliseName(r.canonical) || canonicalise(r.original) })),
        steps: steps.map((s) => s.trim()).filter(Boolean),
        nutrition: Object.values(n).some((v) => v != null) ? n : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      setSaving(false);
    }
  }

  // Tag states: confirmed (in tags), suggested (in suggestedTags), off.
  function clickTag(t: string) {
    if (d.suggestedTags.includes(t)) set({ suggestedTags: d.suggestedTags.filter((x) => x !== t), tags: [...d.tags, t] });
    else set({ tags: toggle(d.tags, t) });
  }

  return (
    <form className="editor" onSubmit={submit}>
      <div className="editor-top">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          <Icon name="back" size={18} /> Cancel
        </button>
        <h1 className="h-display h-md">{title}</h1>
        <button type="submit" className="btn btn-primary" disabled={saving || uploading}>
          {saving ? "Saving…" : <><Icon name="check" size={18} /> Save</>}
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="editor-grid">
        <section className="ed-card">
          <h2 className="ed-title">Basics</h2>
          <label className="field">
            <span className="field-label">Recipe name</span>
            <input className="input input-lg" value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Grandma's rajma chawal" required />
          </label>

          <div className="field">
            <span className="field-label">Photo</span>
            <div className="photo-field">
              {d.imageUrl ? (
                photoSrc ? <img src={photoSrc} alt="" className="photo-preview" /> : <div className="photo-empty" />
              ) : (
                <div className="photo-empty"><Icon name="image" size={28} /></div>
              )}
              <div className="col gap-xs">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Icon name="camera" size={16} /> {uploading ? "Uploading…" : d.imageUrl ? "Replace photo" : "Upload photo"}
                </button>
                {d.imageUrl && (
                  <button type="button" className="link-btn" onClick={() => set({ imageUrl: null })}>Remove photo</button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPickImage(e.target.files?.[0])} />
            </div>
          </div>

          <div className="field-row">
            <label className="field">
              <span className="field-label">Prep (min){d.timesEstimated && <span className="est-badge sm">est.</span>}</span>
              <input className="input" inputMode="numeric" value={d.prepMinutes ?? ""} onChange={(e) => set({ prepMinutes: numOrNull(e.target.value), timesEstimated: false })} />
            </label>
            <label className="field">
              <span className="field-label">Cook (min){d.timesEstimated && <span className="est-badge sm">est.</span>}</span>
              <input className="input" inputMode="numeric" value={d.cookMinutes ?? ""} onChange={(e) => set({ cookMinutes: numOrNull(e.target.value), timesEstimated: false })} />
            </label>
            <label className="field">
              <span className="field-label">Serves{d.servingsEstimated && <span className="est-badge sm">est.</span>}</span>
              <input className="input" inputMode="numeric" value={d.servings ?? ""} onChange={(e) => set({ servings: numOrNull(e.target.value), servingsEstimated: false })} />
            </label>
          </div>

          <label className="field">
            <span className="field-label">Original Instagram link</span>
            <input className="input" type="url" value={d.sourceUrl ?? ""} onChange={(e) => set({ sourceUrl: e.target.value })} placeholder="Instagram Reel or YouTube link" />
          </label>
        </section>

        <section className="ed-card">
          <h2 className="ed-title">Categories</h2>
          <span className="field-label">Cuisine</span>
          <div className="chip-wrap">
            {CUISINES.map((c) => <ToggleChip key={c} label={c} tone="cobalt" on={d.cuisines.includes(c)} onClick={() => set({ cuisines: toggle(d.cuisines, c) })} />)}
          </div>
          <span className="field-label">Meal</span>
          <div className="chip-wrap">
            {MEALS.map((m) => <ToggleChip key={m} label={m} tone="butter" on={d.meals.includes(m)} onClick={() => set({ meals: toggle(d.meals, m) })} />)}
          </div>
          <span className="field-label">Diet & nutrition tags</span>
          <div className="chip-wrap">
            {TAGS.map((t) => (
              <ToggleChip key={t} label={t} tone="tomato" on={d.tags.includes(t)} suggested={d.suggestedTags.includes(t)} onClick={() => clickTag(t)} />
            ))}
          </div>
          {d.suggestedTags.length > 0 && <p className="muted small">Dashed tags are suggestions. Tap one to confirm it, or leave it.</p>}
        </section>

        <section className="ed-card span-2">
          <div className="ed-head">
            <h2 className="ed-title">Ingredients</h2>
            <button type="button" className="link-btn" onClick={() => setBulk(bulk === "ingredients" ? "" : "ingredients")}>Paste a list</button>
          </div>
          {bulk === "ingredients" && (
            <div className="bulk">
              <textarea className="input" rows={6} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={"One ingredient per line\n200 g paneer, cubed\n2 bunches spinach"} />
              <button type="button" className="btn btn-outline btn-sm" onClick={applyBulk}>Add these</button>
            </div>
          )}
          <p className="muted small">Write each ingredient exactly as you like. The small grey name is what Crumb uses for ingredient search, and you can change it.</p>
          <ul className="ed-ings">
            {rows.map((r) => (
              <li key={r.id}>
                <div className="col grow">
                  <input className="input" value={r.original} onChange={(e) => updateRow(r.id, e.target.value)} placeholder="e.g. 2 tbsp ghee" aria-label="Ingredient" />
                  <label className="canon">
                    <span>search as</span>
                    <input
                      value={r.canonical}
                      onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, canonical: e.target.value, autoCanonical: false } : x)))}
                      aria-label="Standard ingredient name"
                    />
                  </label>
                </div>
                <button type="button" className="icon-btn" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} aria-label="Remove ingredient">
                  <Icon name="x" size={18} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows((rs) => [...rs, { id: newId(), original: "", canonical: "", autoCanonical: true }])}>
            <Icon name="plus" size={16} /> Add ingredient
          </button>
        </section>

        <section className="ed-card span-2">
          <div className="ed-head">
            <h2 className="ed-title">Method</h2>
            <button type="button" className="link-btn" onClick={() => setBulk(bulk === "steps" ? "" : "steps")}>Paste steps</button>
          </div>
          {bulk === "steps" && (
            <div className="bulk">
              <textarea className="input" rows={6} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="One step per line" />
              <button type="button" className="btn btn-outline btn-sm" onClick={applyBulk}>Add these</button>
            </div>
          )}
          <ol className="ed-steps">
            {steps.map((s, i) => (
              <li key={i}>
                <span className="step-num sm">{i + 1}</span>
                <textarea className="input grow" rows={2} value={s} onChange={(e) => setSteps((ss) => ss.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Step ${i + 1}`} />
                <div className="col">
                  <button type="button" className="icon-btn" onClick={() => moveStep(i, -1)} disabled={i === 0} aria-label="Move step up"><Icon name="up" size={16} /></button>
                  <button type="button" className="icon-btn" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} aria-label="Move step down"><Icon name="down" size={16} /></button>
                </div>
                <button type="button" className="icon-btn" onClick={() => setSteps((ss) => ss.filter((_, j) => j !== i))} aria-label="Remove step"><Icon name="x" size={18} /></button>
              </li>
            ))}
          </ol>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSteps((ss) => [...ss, ""])}>
            <Icon name="plus" size={16} /> Add step
          </button>
        </section>

        <section className="ed-card span-2">
          <h2 className="ed-title">Nutrition per serving <span className="muted small">(optional)</span></h2>
          <div className="field-row five">
            {(["calories", "protein", "carbs", "fat", "fibre"] as const).map((k) => (
              <label key={k} className="field">
                <span className="field-label">{displayName(k)} {k === "calories" ? "(kcal)" : "(g)"}</span>
                <input className="input" inputMode="decimal" value={n[k] ?? ""} onChange={(e) => set({ nutrition: { ...n, [k]: numOrNull(e.target.value) } })} />
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="editor-foot">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary btn-lg" disabled={saving || uploading}>
          {saving ? "Saving…" : "Save recipe"}
        </button>
      </div>
    </form>
  );
}
