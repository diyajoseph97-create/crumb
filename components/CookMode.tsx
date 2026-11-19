// Cook mode: big text, one step at a time, ingredients to tick off, and the
// screen stays on. Ends with "I made this" and a rating.
import { useEffect, useRef, useState } from "react";
import type { Recipe } from "@/lib/types";
import { splitIngredient } from "@/lib/scale";
import { Icon } from "./ui";

type Props = {
  recipe: Recipe;
  /** Ingredient lines as currently shown (scaled, units switched). */
  lines: string[];
  servingsLabel: string;
  onClose: () => void;
  /** Owner only: record that it was cooked (and an optional rating). */
  onCooked?: (rating: number | null) => void;
};

export function CookMode({ recipe, lines, servingsLabel, onClose, onCooked }: Props) {
  const steps = recipe.steps;
  const total = steps.length + 2; // ingredients, steps…, done
  const [page, setPage] = useState(0);
  const [ticked, setTicked] = useState<number[]>([]);
  const [rating, setRating] = useState<number | null>(recipe.rating ?? null);
  const [saved, setSaved] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Keep the screen awake while cooking (where the browser allows it).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    const get = () => nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    get();
    const again = () => document.visibilityState === "visible" && get();
    document.addEventListener("visibilitychange", again);
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("visibilitychange", again);
      lock?.release().catch(() => {});
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") setPage((p) => Math.min(total - 1, p + 1));
      if (e.key === "ArrowLeft") setPage((p) => Math.max(0, p - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, total]);

  const stepIndex = page - 1;
  return (
    <div className="cook" role="dialog" aria-modal="true" aria-label={`Cooking ${recipe.name}`}>
      <header className="cook-top">
        <div className="cook-title">
          <span className="cook-kicker">Cooking</span>
          <span className="cook-name">{recipe.name}</span>
        </div>
        <button ref={closeRef} className="icon-btn lg" onClick={onClose} aria-label="Leave cook mode"><Icon name="x" /></button>
      </header>
      <div className="cook-progress" aria-hidden="true"><span style={{ width: `${(page / (total - 1)) * 100}%` }} /></div>

      <main className="cook-body" aria-live="polite">
        {page === 0 && (
          <section>
            <h2 className="cook-h">Get everything ready</h2>
            <p className="cook-sub">{servingsLabel} · tap each one as you set it out</p>
            <ul className="cook-ings">
              {lines.map((l, i) => {
                const { qty, name } = splitIngredient(l);
                const on = ticked.includes(i);
                return (
                  <li key={i}>
                    <button className={`cook-ing ${on ? "on" : ""}`} aria-pressed={on} onClick={() => setTicked((t) => (on ? t.filter((x) => x !== i) : [...t, i]))}>
                      <span className="cook-check">{on && <Icon name="check" size={16} />}</span>
                      <span className="cook-qty">{qty}</span> <span>{name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {lines.length === 0 && <p className="cook-sub">No ingredients listed for this one.</p>}
          </section>
        )}

        {stepIndex >= 0 && stepIndex < steps.length && (
          <section>
            <p className="cook-step-no">Step {stepIndex + 1} of {steps.length}</p>
            <p className="cook-step">{steps[stepIndex]}</p>
          </section>
        )}

        {page === total - 1 && (
          <section className="cook-done">
            <h2 className="cook-h">Enjoy your {recipe.name}!</h2>
            {onCooked ? (
              saved ? (
                <p className="cook-sub">Marked as cooked{rating ? ` · ${rating} ${rating === 1 ? "star" : "stars"}` : ""}. Nice one.</p>
              ) : (
                <>
                  <p className="cook-sub">How did it turn out?</p>
                  <Stars value={rating} onChange={setRating} size={34} />
                  <button className="btn btn-primary btn-lg" onClick={() => { onCooked(rating); setSaved(true); }}>
                    <Icon name="check" size={18} /> I made this
                  </button>
                </>
              )
            ) : (
              <p className="cook-sub">Happy cooking.</p>
            )}
          </section>
        )}
      </main>

      <footer className="cook-nav">
        <button className="btn btn-outline btn-lg" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
          <Icon name="back" size={18} /> Back
        </button>
        {page < total - 1 ? (
          <button className="btn btn-primary btn-lg" onClick={() => setPage((p) => Math.min(total - 1, p + 1))}>
            {page === 0 ? (steps.length ? "Start cooking" : "Done") : stepIndex === steps.length - 1 ? "Done" : "Next step"}
          </button>
        ) : (
          <button className="btn btn-primary btn-lg" onClick={onClose}>Close</button>
        )}
      </footer>
    </div>
  );
}

/** 1–5 stars; tap the same star again to clear. */
export function Stars({ value, onChange, size = 20 }: { value: number | null; onChange?: (v: number | null) => void; size?: number }) {
  return (
    <span className="stars" role={onChange ? "radiogroup" : "img"} aria-label={value ? `${value} out of 5 stars` : "Not rated"}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} className={`star ${value && n <= value ? "on" : ""}`} onClick={() => onChange(value === n ? null : n)}>
            <Icon name="star" size={size} filled={Boolean(value && n <= value)} />
          </button>
        ) : (
          <span key={n} className={`star ${value && n <= value ? "on" : ""}`}><Icon name="star" size={size} filled={Boolean(value && n <= value)} /></span>
        ),
      )}
    </span>
  );
}
