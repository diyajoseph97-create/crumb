// Import from an Instagram link:
// 1. duplicate check
// 2. fetch caption, thumbnail and video link
// 3. AI reads the caption
// 4. if the recipe isn't complete from the caption, "watch" the video and read both together
// 5. keep our own copy of the photo, then save (even if incomplete, nothing invented)
import { NextResponse } from "next/server";
import { copyRemoteImage, DuplicateError, findByShortcode, insertRecipe } from "@/lib/server/db";
import { fetchInstagram } from "@/lib/server/instagram";
import { aiConfigured, structureRecipe } from "@/lib/server/ai";
import { transcribeVideo, videoConfigured } from "@/lib/server/video";
import { canonicalInstagramUrl, emptyDraft, instagramShortcode, isIncomplete } from "@/lib/recipe-utils";
import type { ImportResult, RecipeDraft } from "@/lib/types";

export const maxDuration = 300; // watching a video can take a minute or two
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const reply = (r: ImportResult, status = 200) => NextResponse.json(r, { status });
  try {
    const { url } = await req.json();
    const code = instagramShortcode(String(url ?? ""));
    if (!code) return reply({ status: "error", message: "That doesn't look like an Instagram Reel or post link." }, 400);

    const existing = await findByShortcode(code);
    if (existing) return reply({ status: "duplicate", recipe: existing });

    if (!aiConfigured()) {
      return reply({ status: "error", message: "Crumb's AI key (ANTHROPIC_API_KEY) isn't set up yet, so it can't read recipes." }, 500);
    }

    const sourceUrl = canonicalInstagramUrl(code);
    const ig = await fetchInstagram(code, sourceUrl);
    const notes: string[] = [];
    const readFrom: string[] = [];

    // Photo first, so the AI can see the finished dish (helps with the name and categories only).
    const imageUrl = ig.imageUrl ? await copyRemoteImage(ig.imageUrl) : null;
    const images = imageUrl ? [imageUrl] : [];

    let draft: RecipeDraft = {
      ...emptyDraft(),
      name: "Recipe from Instagram",
      imageUrl,
      sourceUrl,
      sourceShortcode: code,
      originalCaption: ig.caption,
    };
    let aiNote = "";

    // Pass 1: the caption on its own
    if (ig.caption) {
      try {
        const ai = await structureRecipe({ caption: ig.caption, images });
        draft = { ...draft, ...ai.draft, name: ai.draft.name || draft.name };
        aiNote = ai.notes;
        readFrom.push("caption");
      } catch (e) {
        notes.push(`Reading the caption failed (${(e as Error).message}).`);
      }
    }

    // Pass 2: if the caption wasn't enough, watch the video
    if (isIncomplete(draft)) {
      if (!videoConfigured()) {
        notes.push("The full recipe seems to be in the video, and video reading isn't set up yet (GEMINI_API_KEY).");
      } else if (!ig.videoUrl) {
        notes.push(
          process.env.APIFY_TOKEN
            ? "Instagram didn't provide the video file, so Crumb couldn't watch it."
            : "Instagram blocked access to the video. Adding an Apify token makes this much more reliable."
        );
      } else {
        try {
          const transcript = await transcribeVideo(ig.videoUrl);
          const ai = await structureRecipe({ caption: ig.caption, transcript, images });
          draft = { ...draft, ...ai.draft, name: ai.draft.name || draft.name, sourceTranscript: transcript };
          aiNote = ai.notes;
          readFrom.push("video");
        } catch (e) {
          notes.push(`Crumb couldn't watch the video (${(e as Error).message}).`);
        }
      }
    }

    if (!ig.caption && !readFrom.length) notes.push(...ig.notes);
    if (aiNote) notes.unshift(aiNote);
    if (!imageUrl) notes.push("No photo was available. You can upload one.");
    if (readFrom.length) notes.push(`Read from the ${readFrom.join(" and ")}.`);
    draft.importNotes = notes.join(" ") || null;

    try {
      return reply({ status: "saved", recipe: await insertRecipe(draft) });
    } catch (e) {
      if (e instanceof DuplicateError) {
        const dup = await findByShortcode(code);
        if (dup) return reply({ status: "duplicate", recipe: dup });
      }
      throw e;
    }
  } catch (e) {
    return reply({ status: "error", message: (e as Error).message || "Import failed." }, 500);
  }
}
