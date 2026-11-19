import type { Recipe } from "@/lib/types";

/** The recipe's photo, or a plain grey square with the dish's first letter. */
export function RecipeImage({ recipe, variant = "card" }: { recipe: Recipe; variant?: "card" | "hero" }) {
  if (recipe.imageUrl) {
    return <img className={`rimg rimg-${variant}`} src={recipe.imageUrl} alt={recipe.name} loading="lazy" decoding="async" />;
  }
  return (
    <div className={`placeholder rimg-${variant}`} role="img" aria-label={`No photo yet for ${recipe.name}`}>
      <span className="ph-letter px" aria-hidden="true">{(recipe.name || "?").trim().charAt(0).toUpperCase()}</span>
    </div>
  );
}
