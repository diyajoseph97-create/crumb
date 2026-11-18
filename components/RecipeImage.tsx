"use client";
import { MEAL_STYLE } from "@/lib/constants";
import type { Recipe } from "@/lib/types";
import { Doodle } from "./ui";

// Placeholder shapes vary per recipe so the masonry gallery has rhythm.
const ASPECTS = [1.25, 0.9, 1.1, 1.4, 1, 1.2, 0.85];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function RecipeImage({ recipe, variant = "card" }: { recipe: Recipe; variant?: "card" | "hero" }) {
  if (recipe.imageUrl) {
    return <img className={`rimg rimg-${variant}`} src={recipe.imageUrl} alt={recipe.name} loading="lazy" />;
  }
  const style = MEAL_STYLE[recipe.meals[0]] ?? { colour: "tangerine", doodle: "crumbs" };
  const h = hash(recipe.id);
  const aspect = variant === "card" ? ASPECTS[h % ASPECTS.length] : undefined;
  return (
    <div
      className={`placeholder ph-${style.colour} rimg-${variant}`}
      style={aspect ? { aspectRatio: `1 / ${aspect}` } : undefined}
      role="img"
      aria-label={`No photo yet for ${recipe.name}`}
    >
      <div className="ph-blob" style={{ transform: `rotate(${(h % 60) - 30}deg)` }} />
      <Doodle name={style.doodle} className="ph-doodle" strokeWidth={2} />
      <Doodle name="crumbs" className="ph-crumbs" strokeWidth={2.4} />
      <span className="ph-initial" aria-hidden="true">{recipe.name.trim()[0] ?? "?"}</span>
    </div>
  );
}
