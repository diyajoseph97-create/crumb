// What someone sees when they open a link you shared: your cookbook (or one
// recipe), view only. No sign-in, no key, nothing they do changes anything.
import { useEffect, useMemo, useState } from "react";
import type { Recipe } from "@/lib/types";
import type { Store } from "@/lib/store";
import { fetchShared, readShareCode } from "@/lib/cloud";
import { normaliseRecipe } from "@/lib/validate";
import { isSavedForLater } from "@/lib/recipe-utils";
import { CrumbApp } from "./CrumbApp";
import { Doodle } from "./ui";

const readOnly = () => Promise.reject(new Error("This cookbook is view only."));

export function SharedView({ code }: { code: string }) {
  const share = useMemo(() => readShareCode(code), [code]);
  const [state, setState] = useState<{ title: string; recipeId: string | null; recipes: Recipe[] } | "loading" | "gone" | "error">("loading");

  useEffect(() => {
    if (!share) return setState("gone");
    fetchShared(share)
      .then((s) => {
        if (!s) return setState("gone");
        const recipes = s.recipes.map(normaliseRecipe).filter((r) => !isSavedForLater(r));
        setState({ title: s.title || "crumbs", recipeId: s.recipe_id, recipes });
        document.title = s.title || "crumbs";
        if (s.recipe_id && !location.hash) location.hash = `recipe-${s.recipe_id}`;
      })
      .catch(() => setState("error"));
  }, [share]);

  const store: Store | null = useMemo(
    () =>
      typeof state === "object"
        ? { mode: "remote", list: async () => state.recipes, create: readOnly, update: readOnly, remove: readOnly, uploadImage: readOnly }
        : null,
    [state],
  );

  if (state === "loading")
    return (
      <div className="unlock">
        <div className="shared-msg"><Doodle name="pot" className="add-doodle" /><p className="muted">Opening the cookbook…</p></div>
      </div>
    );
  if (state === "gone" || state === "error")
    return (
      <div className="unlock">
        <div className="unlock-card shared-msg">
          <Doodle name="crumbs" className="add-doodle" />
          <h1 className="h-display h-md">{state === "gone" ? "This link isn't shared anymore." : "Couldn't open this cookbook."}</h1>
          <p className="muted">{state === "gone" ? "Ask the person who sent it for a new link." : "Check your connection and try again in a moment."}</p>
          {state === "error" && <button className="btn btn-primary" onClick={() => location.reload()}>Try again</button>}
        </div>
      </div>
    );
  return (
    <CrumbApp
      store={store!}
      geminiKey={null}
      renderSettings={() => null}
      viewOnly={{ title: (state as { title: string }).title, singleRecipe: Boolean((state as { recipeId: string | null }).recipeId) }}
    />
  );
}
