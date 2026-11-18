"use client";
import { useCallback, useEffect, useState } from "react";
import type { Recipe, RecipeDraft } from "@/lib/types";
import type { Store } from "@/lib/store";
import { EMPTY_FILTERS, type Filters } from "@/lib/filter";
import { canonicalInstagramUrl, emptyDraft, instagramShortcode } from "@/lib/recipe-utils";
import { Home } from "./Home";
import { RecipeDetail } from "./RecipeDetail";
import { RecipeEditor } from "./RecipeEditor";
import { AddRecipeModal, IG_LINK } from "./AddRecipeModal";
import { takeShared } from "@/lib/share";
import { Doodle, Icon, Modal } from "./ui";
import { BlobButton, CircleBadge } from "./Stickers";

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
  /** Change this number to reload the recipe list (e.g. after restoring a backup). */
  reloadToken?: number;
};

export function CrumbApp({ store, geminiKey, renderSettings, reloadToken }: AppProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>({ page: "home" });
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [add, setAdd] = useState<{ open: boolean; fill: Recipe | null; shared?: { url: string; caption: string; files: File[] } | null }>({ open: false, fill: null });
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

  // Opened from the phone's share menu (Instagram → Share → Crumb).
  const pickUpShare = useCallback(async () => {
    if (window.location.hash !== "#shared") return false;
    history.replaceState(null, "", window.location.pathname + window.location.search);
    setRoute({ page: "home" });
    const s = await takeShared();
    if (!s) return true;
    const all = [s.url, s.text, s.title].filter(Boolean).join("\n");
    const link = all.match(IG_LINK)?.[0] || "";
    const caption = (s.text || "").replace(link, "").trim();
    setPendingShare({ url: link, caption, files: s.files });
    return true;
  }, []);

  const [pendingShare, setPendingShare] = useState<{ url: string; caption: string; files: File[] } | null>(null);
  useEffect(() => {
    if (!pendingShare || loading) return; // wait for the cookbook so duplicates are caught
    setAdd({ open: true, fill: null, shared: pendingShare });
    setPendingShare(null);
  }, [pendingShare, loading]);

  useEffect(() => {
    load();
    const onHash = () => {
      if (window.location.hash === "#shared") return void pickUpShare();
      setRoute(parseHash());
      setAdd((a) => (a.open ? { ...a, open: false } : a)); // close any open dialog on navigation
      setSettingsOpen(false);
      window.scrollTo({ top: 0 });
    };
    pickUpShare().then((handled) => !handled && setRoute(parseHash()));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [load, pickUpShare]);

  useEffect(() => {
    if (reloadToken) load();
  }, [reloadToken, load]);

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
        onAdd={() => setAdd({ open: true, fill: null, shared: null })}
        onFill={(r) => setAdd({ open: true, fill: r, shared: null })}
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
        onAddScreenshots={() => setAdd({ open: true, fill: current, shared: null })}
        onSetLink={async (url) => {
          const code = instagramShortcode(url);
          if (!code) return "That doesn't look like an Instagram Reel link. It should look like instagram.com/reel/…";
          const other = recipes.find((x) => x.sourceShortcode === code && x.id !== current.id);
          if (other) return `This Reel is already saved as “${other.name}”.`;
          try {
            upsert(await store.update(current.id, { sourceUrl: canonicalInstagramUrl(code), sourceShortcode: code }));
            toast("Reel link saved");
            return null;
          } catch (e) {
            return e instanceof Error ? e.message : "Couldn't save the link.";
          }
        }}
      />
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="wordmark" onClick={() => go("")} aria-label="Crumb home">
          <span className="wordmark-title">Crumb's Recipes</span>
          <span className="wordmark-sub">(saved from Instagram, cooked at home)</span>
        </button>
        <div className="topbar-stickers">
          <button className="settings-link" onClick={() => setSettingsOpen(true)} aria-label="Settings">
            Settings <span aria-hidden="true">→</span>
          </button>
          <CircleBadge
            className="add-btn"
            text="ADD A RECIPE · ADD A RECIPE · "
            center={<Icon name="plus" size={26} />}
            onClick={() => setAdd({ open: true, fill: null, shared: null })}
            aria-label="Add recipe"
          />
          <BlobButton
            className={`fav-blob ${filters.favourites ? "on" : ""}`}
            onClick={() => {
              setFilters({ ...filters, favourites: !filters.favourites });
              go("");
            }}
            aria-pressed={filters.favourites}
          >
            Favourites
          </BlobButton>
        </div>
      </header>
      <main className="main">{body}</main>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} label="Settings">
        {renderSettings(() => setSettingsOpen(false), recipes)}
      </Modal>

      <AddRecipeModal
        open={add.open}
        fillRecipe={add.fill}
        shared={add.shared ?? null}
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
