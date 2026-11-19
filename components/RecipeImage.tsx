import type { Recipe } from "@/lib/types";
import { Composition } from "./Shapes";

const ASPECTS = [1.25, 0.9, 1.1, 1.4, 1, 1.2, 0.85];

export function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function RecipeImage({ recipe, variant = "card" }: { recipe: Recipe; variant?: "card" | "hero" }) {
  const src = recipe.imageUrl;
  const h = hash(recipe.id);
  const aspect = ASPECTS[h % ASPECTS.length];

  if (recipe.imageUrl && src) {
    return <img className={`rimg rimg-${variant}`} src={src} alt={recipe.name} loading="lazy" decoding="async" />;
  }
  if (recipe.imageUrl && !src) {
    // still loading the photo: keep the space so the gallery doesn't jump
    return <div className={`placeholder ph-loading rimg-${variant}`} style={variant === "card" ? { aspectRatio: `1 / ${aspect}` } : undefined} aria-label="Loading photo" />;
  }
  // No photo yet: a flat modernist composition in this recipe's colours.
  return (
    <div className={`placeholder rimg-${variant}`} style={variant === "card" ? { aspectRatio: `1 / ${aspect}` } : undefined} role="img" aria-label={`No photo yet for ${recipe.name}`}>
      <Composition seed={variant === "card" ? h : h + 2} ratio={variant === "card" ? aspect : 1.15} />
    </div>
  );
}
