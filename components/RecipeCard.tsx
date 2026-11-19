import { memo, useState } from "react";
import type { Recipe } from "@/lib/types";
import { formatMinutes, isIncomplete, isYouTube, totalMinutes } from "@/lib/recipe-utils";
import type { ImportJob } from "@/lib/importer";
import { Icon, useRecipeNumber, useViewOnly } from "./ui";
import { RecipeImage } from "./RecipeImage";

// Cards only re-draw when their own recipe changes (not on every toast or new recipe).
export const RecipeCard = memo(RecipeCardView, (a, b) => a.recipe === b.recipe);

function RecipeCardView({
  recipe, onOpen, onFavourite,
}: { recipe: Recipe; onOpen: () => void; onFavourite: () => void }) {
  const total = totalMinutes(recipe);
  const viewOnly = useViewOnly().on;
  const incomplete = isIncomplete(recipe) && !viewOnly;
  const no = useRecipeNumber(recipe.id);
  return (
    <article className="card">
      <button className="card-hit" onClick={onOpen} aria-label={`Open ${recipe.name}`}>
        <div className="card-media">
          <RecipeImage recipe={recipe} />
          {no && <span className="card-no px" aria-label={`Recipe number ${no}`}>{no}</span>}
          {incomplete && (
            <span className="card-incomplete" title="A few details are missing">
              Needs details
            </span>
          )}
        </div>
        <div className="card-body">
          <h3 className="card-title px">{recipe.name || "Untitled recipe"}</h3>
          {recipe.creator && <p className="card-by">by {recipe.creator.startsWith("@") || recipe.creator.includes(" ") ? recipe.creator : `@${recipe.creator}`}</p>}
          <p className="card-sub">
            {[recipe.cuisines.find((c) => c !== "Indian") ?? recipe.cuisines[0], total != null ? `${recipe.timesEstimated ? "~" : ""}${formatMinutes(total)}` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
      </button>
      {!viewOnly && <button
        className={`fav-btn ${recipe.favourite ? "on" : ""}`}
        onClick={onFavourite}
        aria-pressed={recipe.favourite}
        aria-label={recipe.favourite ? "Remove from favourites" : "Add to favourites"}
      >
        <Icon name="heart" size={18} filled={recipe.favourite} />
      </button>}
    </article>
  );
}

/** A recipe that's still being added in the background (or couldn't be). */
export function JobCard({ job, onRetry, onDismiss }: { job: ImportJob; onRetry: () => void; onDismiss: () => void }) {
  const failed = job.status === "failed";
  const [thumbOk, setThumbOk] = useState(true);
  const from = isYouTube(job.code) ? "From YouTube" : job.files.some((f) => f.type.startsWith("video/")) ? "From your video" : job.files.length ? "From your screenshots" : "From the caption";
  return (
    <article className={`card job-card ${failed ? "is-failed" : "is-adding"}`} aria-live="polite">
      <div className="card-media">
        <div className="job-media">
          {job.thumb && thumbOk ? <img src={job.thumb} alt="" className="job-thumb" onError={() => setThumbOk(false)} /> : null}
          {!failed && <span className="job-shimmer" aria-hidden="true" />}
        </div>
      </div>
      <div className="card-body">
        <h3 className="card-title px">{failed ? "Couldn't add this one" : <>Fetching the good stuff<span className="dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></>}</h3>
        <p className="card-sub">{failed ? job.error : `${from} · you can keep browsing`}</p>
        {failed && (
          <div className="row gap-xs wrap">
            <button className="btn btn-primary btn-sm" onClick={onRetry}>Try again</button>
            <button className="btn btn-ghost btn-sm" onClick={onDismiss}>Remove</button>
          </div>
        )}
      </div>
    </article>
  );
}
