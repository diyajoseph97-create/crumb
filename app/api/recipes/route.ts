import { NextResponse } from "next/server";
import { DuplicateError, findByShortcode, insertRecipe, listRecipes } from "@/lib/server/db";
import { cleanDraft } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ recipes: await listRecipes() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const draft = cleanDraft(await req.json());
    if (!draft.name) return NextResponse.json({ error: "A recipe needs a name." }, { status: 400 });
    if (draft.sourceShortcode && (await findByShortcode(draft.sourceShortcode))) {
      return NextResponse.json({ error: "A recipe with this Instagram link is already in your cookbook." }, { status: 409 });
    }
    return NextResponse.json({ recipe: await insertRecipe(draft) });
  } catch (e) {
    const status = e instanceof DuplicateError ? 409 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
