// Screenshots / pasted caption → recipe.
// With recipeId: fills in an existing incomplete recipe, keeping what it already has.
import { NextResponse } from "next/server";
import { copyRemoteImage, DuplicateError, findByShortcode, getRecipe, insertRecipe, updateRecipe } from "@/lib/server/db";
import { mergeIntoExisting, structureRecipe } from "@/lib/server/ai";
import { fetchInstagram } from "@/lib/server/instagram";
import { canonicalInstagramUrl, emptyDraft, instagramShortcode } from "@/lib/recipe-utils";
import type { ImportResult } from "@/lib/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const reply = (r: ImportResult, status = 200) => NextResponse.json(r, { status });
  try {
    const body = await req.json();
    const images: string[] = Array.isArray(body.images)
      ? body.images.filter((s: unknown) => typeof s === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(s)).slice(0, 6)
      : [];
    const text = typeof body.text === "string" ? body.text.slice(0, 15000) : "";
    if (!images.length && !text.trim()) return reply({ status: "error", message: "Add a screenshot or some text." }, 400);

    // Fill in an existing recipe
    if (body.recipeId) {
      const existing = await getRecipe(String(body.recipeId));
      if (!existing) return reply({ status: "error", message: "That recipe no longer exists." }, 404);
      const ai = await structureRecipe({ caption: text || existing.originalCaption, images, existing });
      const patch = mergeIntoExisting(existing, ai.draft);
      patch.importNotes = ai.notes || null;
      return reply({ status: "saved", recipe: await updateRecipe(existing.id, patch) });
    }

    // New recipe from screenshots
    const code = body.sourceUrl ? instagramShortcode(String(body.sourceUrl)) : null;
    if (code) {
      const dup = await findByShortcode(code);
      if (dup) return reply({ status: "duplicate", recipe: dup });
    }
    const ai = await structureRecipe({ caption: text || null, images });
    if (!ai.isRecipe) return reply({ status: "error", message: "Crumb couldn't find a recipe in those screenshots. Try clearer ones showing the ingredients and method." }, 422);

    let imageUrl: string | null = null;
    if (code) {
      const ig = await fetchInstagram(code, canonicalInstagramUrl(code)).catch(() => null);
      if (ig?.imageUrl) imageUrl = await copyRemoteImage(ig.imageUrl);
    }
    try {
      const recipe = await insertRecipe({
        ...emptyDraft(),
        ...ai.draft,
        name: ai.draft.name || "Untitled recipe",
        imageUrl,
        sourceUrl: code ? canonicalInstagramUrl(code) : null,
        sourceShortcode: code,
        originalCaption: text || null,
        importNotes: ai.notes || null,
      });
      return reply({ status: "saved", recipe });
    } catch (e) {
      if (e instanceof DuplicateError && code) {
        const dup = await findByShortcode(code);
        if (dup) return reply({ status: "duplicate", recipe: dup });
      }
      throw e;
    }
  } catch (e) {
    return reply({ status: "error", message: (e as Error).message || "Couldn't read that." }, 500);
  }
}
