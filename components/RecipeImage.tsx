import { useEffect, useState } from "react";
import type { Recipe } from "@/lib/types";
import { dither, ditheredNow } from "@/lib/dither";

/** The recipe's photo, or a plain grey square with the dish's first letter. Squares everywhere.
 *  On cards the photo is shown as black-and-white dots; hovering shows it in colour. */
export function RecipeImage({ recipe, variant = "card" }: { recipe: Recipe; variant?: "card" | "hero" }) {
  if (recipe.imageUrl) {
    if (variant === "card") return <DitheredPhoto src={recipe.imageUrl} alt={recipe.name} />;
    return <img className={`rimg rimg-${variant}`} src={recipe.imageUrl} alt={recipe.name} loading="lazy" decoding="async" />;
  }
  return (
    <div className={`placeholder rimg-${variant}`} role="img" aria-label={`No photo yet for ${recipe.name}`}>
      <span className="ph-letter px" aria-hidden="true">{(recipe.name || "?").trim().charAt(0).toUpperCase()}</span>
    </div>
  );
}

function DitheredPhoto({ src, alt }: { src: string; alt: string }) {
  const [dots, setDots] = useState<string | undefined>(() => ditheredNow(src));
  useEffect(() => {
    let alive = true;
    const now = ditheredNow(src);
    setDots(now);
    if (!now) dither(src).then((d) => alive && d && setDots(d)).catch(() => {});
    return () => { alive = false; };
  }, [src]);
  return (
    <>
      <img className="rimg rimg-card" src={src} alt={alt} loading="lazy" decoding="async" />
      {dots && <img className="rimg-dots" src={dots} alt="" aria-hidden="true" />}
    </>
  );
}
