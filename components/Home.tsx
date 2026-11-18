"use client";
import { useEffect, useMemo, useState } from "react";
import type { Recipe } from "@/lib/types";
import { MEAL_STYLE, TIME_RANGES } from "@/lib/constants";
import { activeFilterCount, allIngredients, applyFilters, EMPTY_FILTERS, type Filters } from "@/lib/filter";
import { displayName } from "@/lib/synonyms";
import { Doodle, Icon, Modal } from "./ui";
import { FilterPanel } from "./FilterPanel";
import { RecipeCard } from "./RecipeCard";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late-night snack?";
  if (h < 12) return "Good morning!";
  if (h < 17) return "Good afternoon!";
  return "Good evening!";
}

const SHORTCUT_MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks", "Desserts", "Drinks"];

function useColumns() {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setCols(w < 720 ? 2 : w < 1100 ? 2 : w < 1400 ? 3 : 4);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return cols;
}

type Props = {
  recipes: Recipe[];
  loading: boolean;
  filters: Filters;
  setFilters: (f: Filters) => void;
  onOpen: (id: string) => void;
  onFavourite: (r: Recipe) => void;
  onAdd: () => void;
};

export function Home({ recipes, loading, filters, setFilters, onOpen, onFavourite, onAdd }: Props) {
  const [sheet, setSheet] = useState(false);
  const cols = useColumns();
  const results = useMemo(() => applyFilters(recipes, filters), [recipes, filters]);
  const ingredients = useMemo(() => allIngredients(recipes), [recipes]);
  const count = activeFilterCount(filters);
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });

  // Round-robin into columns keeps newest-first order reading left to right.
  const columns = useMemo(() => {
    const c: Recipe[][] = Array.from({ length: cols }, () => []);
    results.forEach((r, i) => c[i % cols].push(r));
    return c;
  }, [results, cols]);

  const chips: { key: string; label: string; tone: string; remove: () => void }[] = [
    ...(filters.favourites ? [{ key: "fav", label: "Favourites", tone: "tomato", remove: () => set({ favourites: false }) }] : []),
    ...filters.include.map((x) => ({ key: "i" + x, label: `With ${displayName(x)}`, tone: "cobalt", remove: () => set({ include: filters.include.filter((y) => y !== x) }) })),
    ...filters.exclude.map((x) => ({ key: "e" + x, label: `No ${displayName(x)}`, tone: "tomato", remove: () => set({ exclude: filters.exclude.filter((y) => y !== x) }) })),
    ...filters.times.map((x) => ({ key: "t" + x, label: TIME_RANGES.find((t) => t.id === x)!.label, tone: "tangerine", remove: () => set({ times: filters.times.filter((y) => y !== x) }) })),
    ...filters.meals.map((x) => ({ key: "m" + x, label: x, tone: "butter", remove: () => set({ meals: filters.meals.filter((y) => y !== x) }) })),
    ...filters.cuisines.map((x) => ({ key: "c" + x, label: x, tone: "cobalt", remove: () => set({ cuisines: filters.cuisines.filter((y) => y !== x) }) })),
    ...filters.tags.map((x) => ({ key: "g" + x, label: x, tone: "tomato", remove: () => set({ tags: filters.tags.filter((y) => y !== x) }) })),
  ];
  if (filters.include.length > 1) chips.splice(1, 0, { key: "match", label: filters.match === "all" ? "Match: ALL" : "Match: ANY", tone: "ink", remove: () => set({ match: filters.match === "all" ? "any" : "all" }) });

  return (
    <div className="home">
      <section className="hero">
        <Doodle name="sparkle" className="hero-deco deco-1" />
        <Doodle name="squiggle" className="hero-deco deco-2" />
        <Doodle name="chilli" className="hero-deco deco-3" />
        <p className="hero-kicker">{greeting()}</p>
        <h1 className="h-display h-xl">
          What are we <span className="hl">cooking</span> today?
        </h1>
        <div className="search-row">
          <label className="search">
            <Icon name="search" size={22} />
            <input
              type="search"
              value={filters.query}
              onChange={(e) => set({ query: e.target.value })}
              placeholder="Search dishes or ingredients: paneer, dosa, quick pasta…"
              aria-label="Search recipes"
            />
            {filters.query && (
              <button className="icon-btn" onClick={() => set({ query: "" })} aria-label="Clear search">
                <Icon name="x" size={18} />
              </button>
            )}
          </label>
          <button className="btn btn-primary btn-lg add-btn" onClick={onAdd}>
            <Icon name="plus" size={20} /> Add recipe
          </button>
        </div>
        <div className="shortcuts" role="group" aria-label="Quick categories">
          <button className={`shortcut tone-tomato ${filters.favourites ? "on" : ""}`} onClick={() => set({ favourites: !filters.favourites })} aria-pressed={filters.favourites}>
            <Icon name="heart" size={16} filled={filters.favourites} /> Favourites
          </button>
          {SHORTCUT_MEALS.map((m, i) => {
            const on = filters.meals.length === 1 && filters.meals[0] === m;
            return (
              <button
                key={m}
                className={`shortcut tone-${MEAL_STYLE[m].colour} ${on ? "on" : ""}`}
                style={{ ["--tilt" as string]: `${i % 2 ? 1.5 : -1.5}deg` }}
                onClick={() => set({ meals: on ? [] : [m] })}
                aria-pressed={on}
              >
                <Doodle name={MEAL_STYLE[m].doodle} className="shortcut-doodle" /> {m}
              </button>
            );
          })}
        </div>
      </section>

      <div className="library">
        <aside className="sidebar" aria-label="Filters">
          <div className="sidebar-head">
            <h2 className="h-display h-sm">Filters</h2>
            {count > 0 && (
              <button className="link-btn" onClick={() => setFilters({ ...EMPTY_FILTERS, query: filters.query })}>
                Clear all
              </button>
            )}
          </div>
          <FilterPanel filters={filters} setFilters={setFilters} ingredients={ingredients} />
        </aside>

        <section className="gallery-wrap" aria-live="polite">
          <div className="gallery-bar">
            <button className="btn btn-outline filters-toggle" onClick={() => setSheet(true)}>
              <Icon name="filter" size={18} /> Filters {count > 0 && <span className="count-badge">{count}</span>}
            </button>
            <p className="result-count">
              {loading ? "Opening your cookbook…" : `${results.length} ${results.length === 1 ? "recipe" : "recipes"}`}
            </p>
          </div>

          {chips.length > 0 && (
            <div className="active-chips">
              {chips.map((c) => (
                <button key={c.key} className={`achip tone-${c.tone}`} onClick={c.remove} aria-label={`Remove filter ${c.label}`}>
                  {c.label} <Icon name="x" size={12} />
                </button>
              ))}
              <button className="link-btn" onClick={() => setFilters({ ...EMPTY_FILTERS, query: filters.query })}>
                Clear all
              </button>
            </div>
          )}

          {!loading && recipes.length === 0 && (
            <div className="empty">
              <Doodle name="pot" className="empty-doodle" />
              <h2 className="h-display h-md">Your cookbook is empty</h2>
              <p className="muted">Paste an Instagram Reel link and Crumb will save the recipe for you.</p>
              <button className="btn btn-primary" onClick={onAdd}>
                <Icon name="plus" size={18} /> Add your first recipe
              </button>
            </div>
          )}

          {!loading && recipes.length > 0 && results.length === 0 && (
            <div className="empty">
              <Doodle name="crumbs" className="empty-doodle" />
              <h2 className="h-display h-md">Not a crumb in sight</h2>
              <p className="muted">
                Nothing matches {filters.query ? <>“{filters.query}”</> : "these filters"}
                {count > 0 ? " with your current filters" : ""}. Try removing a filter or searching for one ingredient.
              </p>
              <div className="row gap-sm center">
                {count > 0 && (
                  <button className="btn btn-outline" onClick={() => setFilters({ ...EMPTY_FILTERS, query: filters.query })}>Clear filters</button>
                )}
                {filters.query && <button className="btn btn-outline" onClick={() => set({ query: "" })}>Clear search</button>}
              </div>
            </div>
          )}

          {loading && (
            <div className="masonry">
              {Array.from({ length: cols }, (_, c) => (
                <div className="mcol" key={c}>
                  {[0, 1].map((i) => <div key={i} className="card skeleton" style={{ height: 220 + ((c + i) % 3) * 60 }} />)}
                </div>
              ))}
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="masonry">
              {columns.map((col, c) => (
                <div className="mcol" key={c}>
                  {col.map((r) => (
                    <RecipeCard key={r.id} recipe={r} onOpen={() => onOpen(r.id)} onFavourite={() => onFavourite(r)} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Modal open={sheet} onClose={() => setSheet(false)} label="Filters" variant="sheet">
        <div className="sheet-head">
          <span className="sheet-grip" aria-hidden="true" />
          <h2 className="h-display h-sm">Filters</h2>
          <button className="icon-btn" onClick={() => setSheet(false)} aria-label="Close filters">
            <Icon name="x" />
          </button>
        </div>
        <div className="sheet-body">
          <FilterPanel filters={filters} setFilters={setFilters} ingredients={ingredients} />
        </div>
        <div className="sheet-foot">
          <button className="btn btn-ghost" onClick={() => setFilters({ ...EMPTY_FILTERS, query: filters.query })}>Clear all</button>
          <button className="btn btn-primary" onClick={() => setSheet(false)}>
            Show {results.length} {results.length === 1 ? "recipe" : "recipes"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

