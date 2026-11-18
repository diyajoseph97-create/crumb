"use client";
import { useMemo, useState } from "react";
import { CUISINES, MEALS, TAGS, TIME_RANGES } from "@/lib/constants";
import type { Filters } from "@/lib/filter";
import { displayName, normaliseName } from "@/lib/synonyms";
import { Icon, ToggleChip } from "./ui";

type Props = {
  filters: Filters;
  setFilters: (f: Filters) => void;
  ingredients: { name: string; count: number }[];
};

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function IngredientPicker({
  label, tone, selected, onAdd, onRemove, ingredients, exclude = [],
}: {
  label: string; tone: "cobalt" | "tomato"; selected: string[]; onAdd: (v: string) => void; onRemove: (v: string) => void;
  ingredients: { name: string; count: number }[]; exclude?: string[];
}) {
  const [q, setQ] = useState("");
  const options = useMemo(() => {
    const nq = normaliseName(q);
    return ingredients
      .filter((i) => !selected.includes(i.name) && !exclude.includes(i.name))
      .filter((i) => !q || i.name.includes(q.toLowerCase()) || i.name.includes(nq))
      .slice(0, q ? 8 : 6);
  }, [q, ingredients, selected, exclude]);

  return (
    <div className="ing-picker">
      <label className="field-label">{label}</label>
      {selected.length > 0 && (
        <div className="chip-row">
          {selected.map((s) => (
            <button key={s} className={`achip tone-${tone}`} onClick={() => onRemove(s)} aria-label={`Remove ${s}`}>
              {displayName(s)} <Icon name="x" size={12} />
            </button>
          ))}
        </div>
      )}
      <div className="mini-search">
        <Icon name="search" size={16} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type an ingredient…"
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key === "Enter" && options[0]) {
              onAdd(options[0].name);
              setQ("");
            }
          }}
        />
      </div>
      <div className="suggest-row">
        {options.map((o) => (
          <button key={o.name} className="suggest" onClick={() => { onAdd(o.name); setQ(""); }}>
            + {displayName(o.name)}
          </button>
        ))}
        {q && options.length === 0 && <span className="muted small">No recipes use “{q}” yet</span>}
      </div>
    </div>
  );
}

export function FilterPanel({ filters: f, setFilters, ingredients }: Props) {
  const set = (patch: Partial<Filters>) => setFilters({ ...f, ...patch });
  return (
    <div className="filters">
      <section className="fgroup">
        <h3 className="fgroup-title">Ingredients</h3>
        <IngredientPicker
          label="Must include"
          tone="cobalt"
          selected={f.include}
          exclude={f.exclude}
          ingredients={ingredients}
          onAdd={(v) => set({ include: [...f.include, v] })}
          onRemove={(v) => set({ include: f.include.filter((x) => x !== v) })}
        />
        {f.include.length > 1 && (
          <div className="seg" role="radiogroup" aria-label="Ingredient match">
            <button role="radio" aria-checked={f.match === "all"} className={f.match === "all" ? "on" : ""} onClick={() => set({ match: "all" })}>
              Has ALL of these
            </button>
            <button role="radio" aria-checked={f.match === "any"} className={f.match === "any" ? "on" : ""} onClick={() => set({ match: "any" })}>
              Has ANY of these
            </button>
          </div>
        )}
        <IngredientPicker
          label="Leave out"
          tone="tomato"
          selected={f.exclude}
          exclude={f.include}
          ingredients={ingredients}
          onAdd={(v) => set({ exclude: [...f.exclude, v] })}
          onRemove={(v) => set({ exclude: f.exclude.filter((x) => x !== v) })}
        />
      </section>

      <section className="fgroup">
        <h3 className="fgroup-title">Total time</h3>
        <div className="chip-wrap">
          {TIME_RANGES.map((t) => (
            <ToggleChip key={t.id} label={t.label} tone="tangerine" on={f.times.includes(t.id)} onClick={() => set({ times: toggle(f.times, t.id) })} />
          ))}
        </div>
      </section>

      <section className="fgroup">
        <h3 className="fgroup-title">Meal</h3>
        <div className="chip-wrap">
          {MEALS.map((m) => (
            <ToggleChip key={m} label={m} tone="butter" on={f.meals.includes(m)} onClick={() => set({ meals: toggle(f.meals, m) })} />
          ))}
        </div>
      </section>

      <section className="fgroup">
        <h3 className="fgroup-title">Cuisine</h3>
        <div className="chip-wrap">
          {CUISINES.map((c) => (
            <ToggleChip key={c} label={c} tone="cobalt" on={f.cuisines.includes(c)} onClick={() => set({ cuisines: toggle(f.cuisines, c) })} />
          ))}
        </div>
      </section>

      <section className="fgroup">
        <h3 className="fgroup-title">Diet & nutrition</h3>
        <div className="chip-wrap">
          {TAGS.map((t) => (
            <ToggleChip key={t} label={t} tone="tomato" on={f.tags.includes(t)} onClick={() => set({ tags: toggle(f.tags, t) })} />
          ))}
        </div>
      </section>
    </div>
  );
}
