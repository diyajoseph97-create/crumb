// Visit /api/export (while unlocked) to download all recipes as a JSON backup.
import { listRecipes } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const recipes = await listRecipes();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), count: recipes.length, recipes }, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="crumb-backup-${date}.json"`,
    },
  });
}
