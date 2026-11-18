import { NextResponse } from "next/server";
import { deleteRecipe, DuplicateError, updateRecipe } from "@/lib/server/db";
import { cleanPatch } from "@/lib/server/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    return NextResponse.json({ recipe: await updateRecipe(id, cleanPatch(await req.json())) });
  } catch (e) {
    const status = e instanceof DuplicateError ? 409 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await deleteRecipe(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
