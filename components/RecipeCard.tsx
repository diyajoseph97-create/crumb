"use client";
import type { Recipe } from "@/lib/types";
import { formatMinutes, isIncomplete, totalMinutes } from "@/lib/recipe-utils";
import { Icon } from "./ui";
import { RecipeImage } from "./RecipeImage";

export function RecipeCard({
  recipe, onOpen, onFavourite,
}: { recipe: Recipe; onOpen: () => void; onFavourite: () => void }) {
  const total = totalMinutes(recipe);
  const tags = [...recipe.tags].slice(0, 2);
  const incomplete = isIncomplete(recipe);
  return (
    <article className="card">
      <button className="card-hit" onClick={onOpen} aria-label={`Open ${recipe.name}`}>
        <div className="card-media">
          <RecipeImage recipe={recipe} />
          {incomplete && (
            <span className="card-incomplete" title="Some details are missing">
              <Icon name="pen" size={12} /> Needs details
            </span>
          )}
        </div>
        <div className="card-body">
          <h3 className="card-title">{recipe.name || "Untitled recipe"}</h3>
          {(recipe.cuisines[0] || recipe.meals[0]) && (
            <p className="card-sub">
              {[recipe.cuisines.find((c) => c !== "Indian") ?? recipe.cuisines[0], recipe.meals[0]].filter(Boolean).join(" · ")}
            </p>
          )}
          <div className="card-foot">
            {total != null && (
              <span className="card-time">
                {recipe.timesEstimated ? "~" : ""}
                {formatMinutes(total).replace("min", "minutes").replace("hr", "hour")}
              </span>
            )}
            {tags.map((t) => (
              <span key={t} className="mini-tag">{t}</span>
            ))}
          </div>
        </div>
      </button>
      <button
        className={`fav-btn ${recipe.favourite ? "on" : ""}`}
        onClick={onFavourite}
        aria-pressed={recipe.favourite}
        aria-label={recipe.favourite ? "Remove from favourites" : "Add to favourites"}
      >
        <Icon name="heart" size={18} filled={recipe.favourite} />
      </button>
    </article>
  );
}
