"use client";
import { useEffect, useState } from "react";
import { MEAL_STYLE } from "@/lib/constants";
import type { Recipe } from "@/lib/types";
import { Doodle } from "./ui";

// Photos stored in your private GitHub repo ("gh:images/…") have to be fetched
// with your token, so the app registers a resolver at start-up.
let resolver: ((url: string) => Promise<string>) | null = null;
const resolved = new Map<string, Promise<string>>();
export function setImageResolver(fn: ((url: string) => Promise<string>) | null) {
  resolver = fn;
  resolved.clear();
}

export function useImageSrc(url: string | null): string | null {
  const direct = url && !url.startsWith("gh:") ? url : null;
  const [src, setSrc] = useState<string | null>(direct);
  useEffect(() => {
    if (!url) return setSrc(null);
    if (!url.startsWith("gh:")) return setSrc(url);
    if (!resolver) return setSrc(null);
    let alive = true;
    if (!resolved.has(url)) resolved.set(url, resolver(url));
    resolved.get(url)!.then((s) => alive && setSrc(s)).catch(() => alive && setSrc(null));
    return () => { alive = false; };
  }, [url]);
  return src;
}

const ASPECTS = [1.25, 0.9, 1.1, 1.4, 1, 1.2, 0.85];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function RecipeImage({ recipe, variant = "card" }: { recipe: Recipe; variant?: "card" | "hero" }) {
  const src = useImageSrc(recipe.imageUrl);
  const style = MEAL_STYLE[recipe.meals[0]] ?? { colour: "tangerine", doodle: "crumbs" };
  const h = hash(recipe.id);
  const aspect = ASPECTS[h % ASPECTS.length];

  if (recipe.imageUrl && src) {
    return <img className={`rimg rimg-${variant}`} src={src} alt={recipe.name} loading="lazy" />;
  }
  if (recipe.imageUrl && !src) {
    // still loading the photo: keep the space so the gallery doesn't jump
    return <div className={`placeholder ph-loading rimg-${variant}`} style={variant === "card" ? { aspectRatio: `1 / ${aspect}` } : undefined} aria-label="Loading photo" />;
  }
  return (
    <div
      className={`placeholder ph-${style.colour} rimg-${variant}`}
      style={variant === "card" ? { aspectRatio: `1 / ${aspect}` } : undefined}
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
