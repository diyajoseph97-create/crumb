// Home page, after kamalasrecipes.com: a butter-yellow welcome panel with a
// script accent, a scrolling ribbon, underlined dropdown filters, and a grid
// of large-photo recipe cards.
import { useEffect, useMemo, useState } from "react";
import type { Recipe } from "@/lib/types";
import { activeFilterCount, allIngredients, applyFilters, EMPTY_FILTERS, type Filters } from "@/lib/filter";
import { displayName } from "@/lib/synonyms";
import { captionNotRead } from "@/lib/importer";
import { isSavedForLater, isYouTube, totalMinutes } from "@/lib/recipe-utils";
import { Dropdown, Icon, Modal, useViewOnly } from "./ui";
import { FilterPanel } from "./FilterPanel";
import { JobCard, RecipeCard } from "./RecipeCard";
import { Masonry } from "./Masonry";
import type { ImportJob } from "@/lib/importer";

const QUICK_MEALS = ["All recipes", "Breakfast", "Lunch", "Dinner", "Snacks", "Desserts"] as const;

type Sort = "recent" | "az" | "quickest" | "favourites" | "made";
const SORTS: { value: Sort; label: string }[] = [
  { value: "recent", label: "Recently added" },
  { value: "az", label: "A–Z" },
  { value: "quickest", label: "Quickest first" },
  { value: "favourites", label: "Favourites first" },
  { value: "made", label: "Most made" },
];
function sortRecipes(list: Recipe[], sort: Sort): Recipe[] {
  if (sort === "recent") return list; // already newest first
  const copy = [...list];
  if (sort === "az") copy.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "quickest") copy.sort((a, b) => (totalMinutes(a) ?? Infinity) - (totalMinutes(b) ?? Infinity));
  if (sort === "favourites") copy.sort((a, b) => Number(b.favourite) - Number(a.favourite));
  if (sort === "made") copy.sort((a, b) => (b.cookedCount ?? 0) - (a.cookedCount ?? 0) || (b.rating ?? 0) - (a.rating ?? 0));
  return copy;
}

function useColumns() {
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setCols(w < 700 ? 2 : w < 1100 ? 3 : 4);
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
  jobs?: ImportJob[];
  onRetryJob?: (j: ImportJob) => void;
  onDismissJob?: (j: ImportJob) => void;
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
                  {isYouTube(r.sourceShortcode) || captionNotRead(r.importNotes) || !r.importNotes?.includes("“Add the video”") ? "Read it" : "Add the video"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function Home({ recipes: all, loading, filters, setFilters, onOpen, onFavourite, onAdd, onFill, jobs = [], onRetryJob, onDismissJob }: Props) {
  const [sheet, setSheet] = useState(false);
  const viewOnly = useViewOnly().on;
  const inbox = useMemo(() => all.filter(isSavedForLater), [all]);
  const recipes = useMemo(() => all.filter((r) => !isSavedForLater(r)), [all]);
  const cols = useColumns();
  const [sort, setSortState] = useState<Sort>(() => {
    try {
      return (localStorage.getItem("crumb-sort") as Sort) || "recent";
    } catch {
      return "recent";
    }
  });
  const setSort = (v: Sort) => {
    setSortState(v);
    try { localStorage.setItem("crumb-sort", v); } catch {}
  };
  const results = useMemo(() => sortRecipes(applyFilters(recipes, filters), sort), [recipes, filters, sort]);
  const ingredients = useMemo(() => allIngredients(recipes), [recipes]);
  const count = activeFilterCount(filters);
  // Everything set inside the Filters sheet (meal buttons are counted separately).
  const quickMeal = filters.meals.length === 1 && (QUICK_MEALS as readonly string[]).includes(filters.meals[0]);
  const collections = useMemo(() => [...new Set(recipes.flatMap((r) => r.collections ?? []))].sort((a, b) => a.localeCompare(b)), [recipes]);
  const sheetCount = (filters.untried ? 1 : 0) + filters.include.length + filters.exclude.length + filters.times.length + filters.cuisines.length + filters.tags.length + (quickMeal ? 0 : filters.meals.length);
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const clearAll = () => setFilters({ ...EMPTY_FILTERS, query: filters.query });

  // Recipes still being added come first, then the cookbook (one list, in reading order).
  const gridItems = useMemo(
    () => [
      ...jobs.map((job) => ({ key: job.id, node: <JobCard job={job} onRetry={() => onRetryJob?.(job)} onDismiss={() => onDismissJob?.(job)} /> })),
      ...results.map((r) => ({ key: r.id, node: <RecipeCard recipe={r} onOpen={() => onOpen(r.id)} onFavourite={() => onFavourite(r)} /> })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results, jobs],
  );

  const chips: { key: string; label: string; tone: string; remove: () => void }[] = [
    ...(filters.favourites ? [{ key: "fav", label: "Favourites", tone: "green", remove: () => set({ favourites: false }) }] : []),
    ...(filters.untried ? [{ key: "untried", label: "Not made yet", tone: "", remove: () => set({ untried: false }) }] : []),
    ...filters.collections.map((c) => ({ key: "c" + c, label: c, tone: "", remove: () => set({ collections: filters.collections.filter((x) => x !== c) }) })),
    ...filters.include.map((x) => ({ key: "i" + x, label: `With ${displayName(x)}`, tone: "", remove: () => set({ include: filters.include.filter((y) => y !== x) }) })),
    ...filters.exclude.map((x) => ({ key: "e" + x, label: `No ${displayName(x)}`, tone: "tomato", remove: () => set({ exclude: filters.exclude.filter((y) => y !== x) }) })),
  ];
  if (filters.include.length > 1) chips.push({ key: "match", label: filters.match === "all" ? "Match: ALL" : "Match: ANY", tone: "ink", remove: () => set({ match: filters.match === "all" ? "any" : "all" }) });

  return (
    <div className="home">
      <section className="browse" aria-labelledby="whats-cooking">
        <div className="home-top">
          <h1 className="home-title px" id="whats-cooking">{filters.favourites ? "Favourites" : "What's cooking?"}</h1>
        </div>
        <label className="search">
          <Icon name="search" size={20} className="search-icon" />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="Search paneer, quick dinner…"
            aria-label="Search recipes"
          />
          {filters.query && (
            <button className="search-clear" onClick={() => set({ query: "" })} aria-label="Clear search"><Icon name="x" size={18} /></button>
          )}
        </label>

        <div className="quick-cats" role="group" aria-label="Meal">
          {QUICK_MEALS.map((m) => {
            const on = m === "All recipes" ? filters.meals.length === 0 : filters.meals.length === 1 && filters.meals[0] === m;
            return (
              <button key={m} className={`quick-cat ${on ? "on" : ""}`} aria-pressed={on} onClick={() => set({ meals: m === "All recipes" || on ? [] : [m] })}>
                {m === "All recipes" ? "All" : m}
              </button>
            );
          })}
          <span className="quick-gap" />
          <button className={`tool-btn filters-toggle ${sheetCount ? "on" : ""}`} onClick={() => setSheet(true)}>
            <Icon name="filter" size={16} />Filters{sheetCount ? ` · ${sheetCount}` : ""}
          </button>
          <Dropdown className="sort" label="Sort recipes" value={sort} options={SORTS} onChange={(v) => setSort(v as Sort)} />
        </div>

        {collections.length > 0 && (
          <div className="coll-row" role="group" aria-label="Collections">
            <span className="label">Collections</span>
            {collections.map((c) => {
              const on = filters.collections.includes(c);
              return (
                <button key={c} className={`quick-cat ${on ? "on" : ""}`} aria-pressed={on} onClick={() => set({ collections: on ? filters.collections.filter((x) => x !== c) : [...filters.collections, c] })}>
                  {c}
                </button>
              );
            })}
          </div>
        )}

        <div className="browse-bar">
          <p className="result-count">
            {loading ? "Opening your cookbook…" : `${results.length} ${results.length === 1 ? "recipe" : "recipes"}${jobs.some((j) => j.status === "adding") ? ` · ${jobs.filter((j) => j.status === "adding").length} being added` : ""}`}
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

        {!viewOnly && inbox.length > 0 && <Inbox items={inbox} onFill={onFill} onOpen={onOpen} />}

        {!loading && recipes.length === 0 && inbox.length === 0 && jobs.length === 0 && (
          <div className="empty">
            {viewOnly ? (
              <>
                <h2 className="h-display">Nothing shared here yet.</h2>
                <p className="muted">Recipes will show up here once they're added.</p>
              </>
            ) : (
              <>
                <h2 className="h-display">Your cookbook is waiting to be filled.</h2>
                <p className="muted">That recipe you've been meaning to try? Start here. Save a link and let's give it a home.</p>
                <button className="btn btn-primary" onClick={onAdd}>
                  + Add your first recipe
                </button>
              </>
            )}
          </div>
        )}

        {!loading && recipes.length > 0 && results.length === 0 && (
          <div className="empty">
            <h2 className="h-display">Nothing on the menu just yet.</h2>
            <p className="muted">Try another ingredient or loosen up those filters.</p>
            <div className="row gap-sm center">
              <button className="btn btn-outline" onClick={() => setFilters({ ...EMPTY_FILTERS })}>Clear filters</button>
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

        {!loading && (results.length > 0 || jobs.length > 0) && (
          <Masonry cols={cols} items={gridItems} resetKey={`${JSON.stringify(filters)}|${sort}`} />
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
