"use client";
// Home page, after kamalasrecipes.com: a butter-yellow welcome panel with a
// script accent, a scrolling ribbon, underlined dropdown filters, and a grid
// of large-photo recipe cards.
import { useEffect, useMemo, useState } from "react";
import type { Recipe } from "@/lib/types";
import { CUISINES, MEALS, TAGS, TIME_RANGES } from "@/lib/constants";
import { activeFilterCount, allIngredients, applyFilters, EMPTY_FILTERS, type Filters } from "@/lib/filter";
import { displayName } from "@/lib/synonyms";
import { isSavedForLater, isYouTube } from "@/lib/recipe-utils";
import { Doodle, Icon, Modal } from "./ui";
import { TableScene } from "./Porcelain";
import { Dropdown } from "./Dropdown";
import { Marquee } from "./Stickers";
import { FilterPanel } from "./FilterPanel";
import { RecipeCard } from "./RecipeCard";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late-night snack?";
  if (h < 12) return "Good morning!";
  if (h < 17) return "Good afternoon!";
  return "Good evening!";
}

function useColumns() {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setCols(w < 1100 ? 2 : 3);
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
  onFill: (r: Recipe) => void;
};

function ago(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

function Inbox({ items, onFill, onOpen }: { items: Recipe[]; onFill: (r: Recipe) => void; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="inbox" aria-label="Saved for later">
      <button className="inbox-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="inbox-title">Saved for later</span>
        <span className="count-badge">{items.length}</span>
        <Icon name="down" size={18} className={`inbox-chev ${open ? "up" : ""}`} />
      </button>
      {open && (
        <ul className="inbox-list">
          {items.map((r) => {
            const preview = r.originalCaption?.split("\n").find((l) => l.trim())?.slice(0, 90);
            return (
              <li key={r.id} className="inbox-item">
                <button className="inbox-main" onClick={() => onOpen(r.id)}>
                  <span className="inbox-name">{preview || `${isYouTube(r.sourceShortcode) ? "YouTube video" : "Instagram Reel"} · ${(r.sourceShortcode ?? "").replace(/^yt:/, "")}`}</span>
                  <span className="muted small">Saved {ago(r.createdAt)}{r.originalCaption ? " · caption saved" : ""}</span>
                </button>
                <a className="icon-btn" href={r.sourceUrl!} target="_blank" rel="noopener noreferrer" aria-label="Open on Instagram" title="Open on Instagram">
                  <Icon name="external" size={16} />
                </a>
                <button className="btn btn-primary btn-sm" onClick={() => onFill(r)}>
                  Read it
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function Home({ recipes: all, loading, filters, setFilters, onOpen, onFavourite, onAdd, onFill }: Props) {
  const [sheet, setSheet] = useState(false);
  const inbox = useMemo(() => all.filter(isSavedForLater), [all]);
  const recipes = useMemo(() => all.filter((r) => !isSavedForLater(r)), [all]);
  const cols = useColumns();
  const results = useMemo(() => applyFilters(recipes, filters), [recipes, filters]);
  const ingredients = useMemo(() => allIngredients(recipes), [recipes]);
  const count = activeFilterCount(filters);
  const ingCount = filters.include.length + filters.exclude.length;
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const clearAll = () => setFilters({ ...EMPTY_FILTERS, query: filters.query });

  // Round-robin into columns keeps newest-first order reading left to right.
  const columns = useMemo(() => {
    const c: Recipe[][] = Array.from({ length: cols }, () => []);
    results.forEach((r, i) => c[i % cols].push(r));
    return c;
  }, [results, cols]);

  const chips: { key: string; label: string; tone: string; remove: () => void }[] = [
    ...(filters.favourites ? [{ key: "fav", label: "Favourites", tone: "green", remove: () => set({ favourites: false }) }] : []),
    ...filters.include.map((x) => ({ key: "i" + x, label: `With ${displayName(x)}`, tone: "", remove: () => set({ include: filters.include.filter((y) => y !== x) }) })),
    ...filters.exclude.map((x) => ({ key: "e" + x, label: `No ${displayName(x)}`, tone: "tomato", remove: () => set({ exclude: filters.exclude.filter((y) => y !== x) }) })),
  ];
  if (filters.include.length > 1) chips.push({ key: "match", label: filters.match === "all" ? "Match: ALL" : "Match: ANY", tone: "ink", remove: () => set({ match: filters.match === "all" ? "any" : "all" }) });

  return (
    <div className="home">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="hero-kicker">{greeting()}</p>
          <h1 className="h-display hero-title">
            Let's get cooking from your <em className="script">saved Reels.</em>
          </h1>
          <p className="hero-sub">
            {recipes.length > 0
              ? `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"} in your cookbook${inbox.length ? `, ${inbox.length} waiting to be read` : ""}.`
              : "Drop in a downloaded Reel and Crumb writes up the recipe."}
          </p>
        </div>
        <TableScene className="hero-art" />
      </section>

      <Marquee items={["Save it once", "Find it whenever", "Cook without rewatching", "No more lost Reels"]} />

      <section className="browse" aria-label="Browse recipes">
        <label className="search">
          <Icon name="search" size={22} />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="Search a dish or an ingredient…"
            aria-label="Search recipes"
          />
          {filters.query && (
            <button className="icon-btn" onClick={() => set({ query: "" })} aria-label="Clear search">
              <Icon name="x" size={18} />
            </button>
          )}
        </label>

        <div className="filter-row">
          <Dropdown allLabel="All times" options={TIME_RANGES.map((t) => ({ value: t.id, label: t.label }))} selected={filters.times} onChange={(v) => set({ times: v })} />
          <Dropdown allLabel="All meals" options={MEALS.map((m) => ({ value: m, label: m }))} selected={filters.meals} onChange={(v) => set({ meals: v })} />
          <Dropdown allLabel="All cuisines" options={CUISINES.map((c) => ({ value: c, label: c }))} selected={filters.cuisines} onChange={(v) => set({ cuisines: v })} />
          <Dropdown allLabel="All diets" options={TAGS.map((t) => ({ value: t, label: t }))} selected={filters.tags} onChange={(v) => set({ tags: v })} />
          <button className="dd-btn dd-more filters-toggle" onClick={() => setSheet(true)}>
            <span className="dd-label">Ingredients{ingCount ? ` (${ingCount})` : ""}</span>
            <Icon name="filter" size={18} />
          </button>
        </div>

        <div className="browse-bar">
          <p className="result-count">
            {loading ? "Opening your cookbook…" : `${results.length} ${results.length === 1 ? "recipe" : "recipes"}`}
          </p>
          {(chips.length > 0 || count > 0) && (
            <div className="active-chips">
              {chips.map((c) => (
                <button key={c.key} className={`achip tone-${c.tone}`} onClick={c.remove} aria-label={`Remove filter ${c.label}`}>
                  {c.label} <Icon name="x" size={12} />
                </button>
              ))}
              {count > 0 && <button className="link-btn" onClick={clearAll}>Clear all</button>}
            </div>
          )}
        </div>

        {inbox.length > 0 && <Inbox items={inbox} onFill={onFill} onOpen={onOpen} />}

        {!loading && recipes.length === 0 && inbox.length === 0 && (
          <div className="empty">
            <Doodle name="pot" className="empty-doodle" />
            <h2 className="h-display">Your cookbook is empty</h2>
            <p className="muted">Download a Reel, then drop it into Crumb and it'll write up the recipe for you.</p>
            <button className="btn btn-primary" onClick={onAdd}>
              <Icon name="plus" size={18} /> Add your first recipe
            </button>
          </div>
        )}

        {!loading && recipes.length > 0 && results.length === 0 && (
          <div className="empty">
            <Doodle name="crumbs" className="empty-doodle" />
            <h2 className="h-display">Not a crumb in sight</h2>
            <p className="muted">
              Nothing matches {filters.query ? <>“{filters.query}”</> : "these filters"}
              {count > 0 ? " with your current filters" : ""}. Try removing a filter or searching for one ingredient.
            </p>
            <div className="row gap-sm center">
              {count > 0 && <button className="btn btn-outline" onClick={clearAll}>Clear filters</button>}
              {filters.query && <button className="btn btn-outline" onClick={() => set({ query: "" })}>Clear search</button>}
            </div>
          </div>
        )}

        {loading && (
          <div className="masonry">
            {Array.from({ length: cols }, (_, c) => (
              <div className="mcol" key={c}>
                {[0, 1].map((i) => <div key={i} className="card skeleton" style={{ height: 260 + ((c + i) % 3) * 60 }} />)}
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

      <Modal open={sheet} onClose={() => setSheet(false)} label="Ingredient filters" variant="sheet">
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
          <button className="btn btn-ghost" onClick={clearAll}>Clear all</button>
          <button className="btn btn-primary" onClick={() => setSheet(false)}>
            Show {results.length} {results.length === 1 ? "recipe" : "recipes"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
