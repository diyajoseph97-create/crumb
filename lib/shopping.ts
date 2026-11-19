// A shopping list made from the recipes you pick, kept on this device.
import { formatAmount, parseAmount, splitIngredient } from "./scale";

export type ListRecipe = { id: string; name: string; servings: number | null; lines: { text: string; canonical: string }[] };
export type ShoppingList = { recipes: ListRecipe[]; checked: string[] };

const KEY = "crumb-shopping";
const listeners = new Set<() => void>();
export function getList(): ShoppingList {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null") ?? { recipes: [], checked: [] };
  } catch {
    return { recipes: [], checked: [] };
  }
}
function save(l: ShoppingList) {
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
  } catch {}
  listeners.forEach((fn) => fn());
}
export const onListChange = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export function addToList(r: ListRecipe) {
  const l = getList();
  save({ ...l, recipes: [...l.recipes.filter((x) => x.id !== r.id), r] });
}
export function removeFromList(id: string) {
  const l = getList();
  save({ ...l, recipes: l.recipes.filter((x) => x.id !== id) });
}
export const isOnList = (id: string) => getList().recipes.some((r) => r.id === id);
export function toggleChecked(key: string) {
  const l = getList();
  save({ ...l, checked: l.checked.includes(key) ? l.checked.filter((k) => k !== key) : [...l.checked, key] });
}
/** "I already have this": take one ingredient off the list (from every recipe on it). */
export function removeItem(key: string) {
  const l = getList();
  const recipes = l.recipes
    .map((r) => ({ ...r, lines: r.lines.filter((line) => (line.canonical || splitIngredient(line.text).name.toLowerCase()) !== key) }))
    .filter((r) => r.lines.length > 0);
  save({ recipes, checked: l.checked.filter((k) => k !== key) });
}
export const clearList = () => save({ recipes: [], checked: [] });

export type ListItem = { key: string; name: string; amount: string; from: string[] };

/** One line per ingredient across all recipes; amounts with the same unit are added up. */
export function combined(l: ShoppingList): ListItem[] {
  const groups = new Map<string, { name: string; parts: { qty: string; recipe: string }[] }>();
  for (const r of l.recipes) {
    for (const line of r.lines) {
      const { qty, name } = splitIngredient(line.text);
      const key = line.canonical || name.toLowerCase();
      const g = groups.get(key) ?? { name: name.replace(/,.*$/, ""), parts: [] };
      g.parts.push({ qty, recipe: r.name });
      groups.set(key, g);
    }
  }
  return [...groups.entries()]
    .map(([key, g]) => {
      // Add up "200 g" + "100 g"; otherwise list the amounts side by side.
      const parsed = g.parts.map((p) => {
        const m = p.qty.match(/^([\d.\/¼½¾⅓⅔⅛⅜⅝⅞\s]+)\s*([a-zA-Z]*)$/);
        const n = m ? parseAmount(m[1].trim()) : null;
        return n != null ? { n, unit: (m![2] || "").toLowerCase() } : null;
      });
      let amount: string;
      if (parsed.every((x) => x) && new Set(parsed.map((x) => x!.unit)).size === 1) {
        const total = parsed.reduce((s, x) => s + x!.n, 0);
        const unit = parsed[0]!.unit;
        const metric = /^(g|kg|ml|l)$/.test(unit);
        amount = `${formatAmount(total, metric)}${unit ? (/^(g|kg|ml|l)$/.test(unit) ? unit : " " + unit) : ""}`;
      } else {
        amount = g.parts.map((p) => p.qty).filter(Boolean).join(" + ");
      }
      return { key, name: g.name, amount, from: [...new Set(g.parts.map((p) => p.recipe))] };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listAsText(l: ShoppingList): string {
  const items = combined(l).filter((i) => !l.checked.includes(i.key));
  return `Shopping list (${l.recipes.map((r) => r.name).join(", ")})\n\n` + items.map((i) => `• ${i.amount ? i.amount + " " : ""}${i.name}`).join("\n");
}
