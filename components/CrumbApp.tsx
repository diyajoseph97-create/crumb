"use client";
import { useCallback, useEffect, useState } from "react";
import type { Recipe, RecipeDraft } from "@/lib/types";
import type { Store } from "@/lib/store";
import { EMPTY_FILTERS, type Filters } from "@/lib/filter";
import { emptyDraft } from "@/lib/recipe-utils";
import { Home } from "./Home";
import { RecipeDetail } from "./RecipeDetail";
import { RecipeEditor } from "./RecipeEditor";
import { AddRecipeModal } from "./AddRecipeModal";
import { Doodle, Icon, Logo, Modal } from "./ui";

// Simple page routing using the part of the URL after "#":
//   (none)        library
//   #recipe-ID    recipe page
//   #edit-ID      edit recipe
//   #new          new recipe typed by hand
type Route = { page: "home" } | { page: "recipe"; id: string } | { page: "edit"; id: string } | { page: "new" };

function parseHash(): Route {
  const h = typeof window === "undefined" ? "" : decodeURIComponent(window.location.hash.replace(/^#/, ""));
  if (h.startsWith("recipe-")) return { page: "recipe", id: h.slice(7) };
  if (h.startsWith("edit-")) return { page: "edit", id: h.slice(5) };
  if (h === "new") return { page: "new" };
  return { page: "home" };
}
const go = (name: string) => {
  window.location.hash = name; // "" = back to the library
};

type Toast = { id: number; text: string; action?: { label: string; run: () => void } };

type AppProps = {
  store: Store;
  geminiKey: string | null;
  /** Renders the settings panel (or, in the demo, the "connect" screen). */
  renderSettings: (close: () => void, recipes: Recipe[]) => React.ReactNode;
};

export function CrumbApp({ store, geminiKey, renderSettings }: AppProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>({ page: "home" });
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [add, setAdd] = useState<{ open: boolean; fill: Recipe | null }>({ open: false, fill: null });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((text: string, action?: Toast["action"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    store
      .list()
      .then((list) => setRecipes(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Couldn't load your recipes."))
      .finally(() => setLoading(false));
  }, [store]);

  useEffect(() => {
    load();
    const onHash = () => {
      setRoute(parseHash());
      setAdd((a) => (a.open ? { ...a, open: false } : a)); // close any open dialog on navigation
      setSettingsOpen(false);
      window.scrollTo({ top: 0 });
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [load]);

  const upsert = (r: Recipe) =>
    setRecipes((list) => {
      const i = list.findIndex((x) => x.id === r.id);
      if (i < 0) return [r, ...list];
      const copy = [...list];
      copy[i] = r;
      return copy;
    });

  async function toggleFavourite(r: Recipe) {
    const next = !r.favourite;
    upsert({ ...r, favourite: next }); // update instantly, then save
    try {
      await store.update(r.id, { favourite: next });
      toast(next ? "Added to favourites ♥" : "Removed from favourites");
    } catch {
      upsert(r);
      toast("Couldn't update favourite. Check your connection.");
    }
  }

  async function remove(r: Recipe) {
    try {
      await store.remove(r.id);
      setRecipes((list) => list.filter((x) => x.id !== r.id));
      go("");
      toast(`Deleted “${r.name}”`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't delete.");
    }
  }

  async function saveEdit(id: string | null, draft: RecipeDraft) {
    const saved = id ? await store.update(id, draft) : await store.create(draft);
    upsert(saved);
    go(`recipe-${saved.id}`);
    toast(id ? "Changes saved" : "Recipe added to your cookbook");
  }

  const current = route.page === "recipe" || route.page === "edit" ? recipes.find((r) => r.id === route.id) : undefined;

  let body: React.ReactNode;
  if (loadError) {
    body = (
      <div className="empty">
        <Doodle name="pot" className="empty-doodle" />
        <h2 className="h-display h-md">Couldn't open your cookbook</h2>
        <p className="muted">{loadError}</p>
        <button className="btn btn-primary" onClick={load}>Try again</button>
      </div>
    );
  } else if (route.page === "home") {
    body = (
      <Home
        recipes={recipes}
        loading={loading}
        filters={filters}
        setFilters={setFilters}
        onOpen={(id) => go(`recipe-${id}`)}
        onFavourite={toggleFavourite}
        onAdd={() => setAdd({ open: true, fill: null })}
      />
    );
  } else if (route.page === "new") {
    body = <RecipeEditor key="new" title="New recipe" initial={emptyDraft()} onCancel={() => history.back()} onSave={(d) => saveEdit(null, d)} uploadImage={store.uploadImage} />;
  } else if (!current) {
    body = loading ? (
      <p className="muted pad">Loading…</p>
    ) : (
      <div className="empty">
        <Doodle name="crumbs" className="empty-doodle" />
        <h2 className="h-display h-md">Recipe not found</h2>
        <p className="muted">It may have been deleted.</p>
        <button className="btn btn-primary" onClick={() => go("")}>Back to the cookbook</button>
      </div>
    );
  } else if (route.page === "edit") {
    const { id, createdAt, updatedAt, ...draft } = current;
    body = <RecipeEditor key={id} title="Edit recipe" initial={draft} onCancel={() => go(`recipe-${id}`)} onSave={(d) => saveEdit(id, d)} uploadImage={store.uploadImage} />;
  } else {
    body = (
      <RecipeDetail
        key={current.id}
        recipe={current}
        onBack={() => go("")}
        onEdit={() => go(`edit-${current.id}`)}
        onDelete={() => remove(current)}
        onFavourite={() => toggleFavourite(current)}
        onAddScreenshots={() => setAdd({ open: true, fill: current })}
      />
    );
  }

  return (
    <div className="app">
      {store.mode === "demo" && (
        <div className="demo-banner">
          <Icon name="sparkle" size={14} /> Sample recipes, saved in this browser only.{" "}
          <button className="link-btn light" onClick={() => setSettingsOpen(true)}>Connect your cookbook</button>
        </div>
      )}
      <header className="topbar">
        <Logo onClick={() => go("")} />
        <div className="row gap-xs">
          {route.page !== "home" && (
            <button className="btn btn-primary btn-sm" onClick={() => setAdd({ open: true, fill: null })}>
              <Icon name="plus" size={16} /> Add recipe
            </button>
          )}
          <button className="icon-btn lg" onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings">
            <Icon name="gear" />
          </button>
        </div>
      </header>
      <main className="main">{body}</main>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} label="Settings">
        {renderSettings(() => setSettingsOpen(false), recipes)}
      </Modal>

      <AddRecipeModal
        open={add.open}
        fillRecipe={add.fill}
        store={store}
        recipes={recipes}
        geminiKey={geminiKey}
        onOpenSettings={() => {
          setAdd((a) => ({ ...a, open: false }));
          setSettingsOpen(true);
        }}
        onClose={() => setAdd((a) => ({ ...a, open: false }))}
        onSaved={upsert}
        onOpenRecipe={(id) => go(`recipe-${id}`)}
        onTypeIn={() => {
          setAdd((a) => ({ ...a, open: false }));
          go("new");
        }}
      />

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
            {t.action && <button className="link-btn light" onClick={t.action.run}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
