// Serving-size scaling.
// We never change the stored ingredient text. Instead, at display time we
// read the quantity at the start of the line, multiply it, and rebuild the line.
// If we can't read the quantity confidently, the line is left as-is and flagged.

export type ScaledLine = {
  text: string;
  /** "scaled" = number changed; "unchanged" = factor is 1;
   *  "unscalable" = factor != 1 but we couldn't safely scale this line. */
  status: "scaled" | "unchanged" | "unscalable";
};

const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3,
  "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875, "⅕": 0.2,
};

// A single amount: "2", "1.5", "1/2", "1 1/2", "1½", "½"
const AMOUNT = String.raw`(?:\d+(?:\.\d+)?\s*[¼½¾⅓⅔⅛⅜⅝⅞⅕]|\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞⅕])`;
// Optional range: "2-3", "2 to 3", "2–3"
const LEADING = new RegExp(String.raw`^\s*(${AMOUNT})(?:\s*(?:-|–|to)\s*(${AMOUNT}))?`);

export function parseAmount(raw: string): number | null {
  const s = raw.trim();
  const uni = s.match(/^(\d+(?:\.\d+)?)?\s*([¼½¾⅓⅔⅛⅜⅝⅞⅕])$/);
  if (uni) return (uni[1] ? parseFloat(uni[1]) : 0) + UNICODE_FRACTIONS[uni[2]];
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[3]) ? parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]) : null;
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[2]) ? parseInt(frac[1]) / parseInt(frac[2]) : null;
  if (/^\d+(?:\.\d+)?$/.test(s)) return parseFloat(s);
  return null;
}

const NOTHING_TO_SCALE = /(to taste|as needed|as required|for garnish|for frying|for greasing|pinch|a little|optional|for serving)/i;

const METRIC_UNIT = /^\s*(g|gm|gms|grams?|kg|ml|l|litres?|liters?)\b/i;

/** Format a number for a recipe: whole numbers, kitchen fractions, or 1 decimal. */
export function formatAmount(n: number, metric = false): string {
  if (metric) {
    if (n >= 10) return String(Math.round(n));
    return String(Math.round(n * 10) / 10);
  }
  const whole = Math.floor(n + 1e-9);
  const rest = n - whole;
  const fractions: [number, string][] = [
    [0, ""], [0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"],
    [2 / 3, "⅔"], [0.75, "¾"], [1, ""],
  ];
  let best = fractions[0];
  for (const f of fractions) if (Math.abs(rest - f[0]) < Math.abs(rest - best[0])) best = f;
  if (Math.abs(rest - best[0]) <= 0.04) {
    const w = best[0] === 1 ? whole + 1 : whole;
    if (!best[1]) return String(w);
    return w > 0 ? `${w}${best[1]}` : best[1];
  }
  return String(Math.round(n * 10) / 10);
}

export function scaleLine(original: string, factor: number): ScaledLine {
  if (!isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-9) {
    return { text: original, status: "unchanged" };
  }
  const m = original.match(LEADING);
  if (!m) {
    // "Salt to taste", "a pinch of…" — nothing to scale, so no warning.
    if (NOTHING_TO_SCALE.test(original)) return { text: original, status: "unchanged" };
    return { text: original, status: "unscalable" };
  }
  const a = parseAmount(m[1]);
  const b = m[2] ? parseAmount(m[2]) : null;
  if (a === null || (m[2] && b === null)) return { text: original, status: "unscalable" };

  const rest = original.slice(m[0].length);
  // Things like "1 can" or "2 packets" are risky to scale; keep them but scale the count.
  const metric = METRIC_UNIT.test(rest);
  const scaledA = formatAmount(a * factor, metric);
  const amountText = b !== null ? `${scaledA}–${formatAmount(b * factor, metric)}` : scaledA;
  const leadingSpace = original.match(/^\s*/)?.[0] ?? "";
  return { text: leadingSpace + amountText + rest, status: "scaled" };
}

export function scaleFactor(original: number | null, desired: number): number {
  if (!original || original <= 0) return 1;
  return desired / original;
}

// ---------- Splitting a line into quantity + ingredient ----------
import { UNITS } from "./synonyms";

const AMOUNT_RE = new RegExp(String.raw`^\s*(${AMOUNT}(?:\s*(?:-|–|to)\s*${AMOUNT})?)\s*`);
const SOFT_QTY = /^(a\s+(?:pinch|handful|dash|few|little|bunch|sprig)(?:es)?(?:\s+of)?|pinch(?:es)?\s+of|a\s+few|few|some|handful\s+of)\s+/i;
const TRAILING_QTY = /[,\s]*\(?\b(to taste|as needed|as required|for garnish|for frying|optional|as per taste)\b\)?\s*$/i;

/** "200 g paneer, cubed" -> { qty: "200 g", name: "Paneer, cubed" }. No amount -> qty "". */
export function splitIngredient(text: string): { qty: string; name: string } {
  let rest = text.trim();
  let qty = "";
  const m = rest.match(AMOUNT_RE);
  if (m) {
    qty = m[1].trim();
    rest = rest.slice(m[0].length);
    const u = rest.match(UNITS);
    if (u) {
      qty += " " + u[0].trim();
      rest = rest.slice(u[0].length);
    }
    // "1 can (400 g) tomatoes" keeps the size note with the quantity
    const paren = rest.match(/^\s*(\([^)]*\))\s*/);
    if (paren) {
      qty += " " + paren[1];
      rest = rest.slice(paren[0].length);
    }
    rest = rest.replace(/^\s*of\s+/i, "");
  } else {
    const soft = rest.match(SOFT_QTY);
    if (soft) {
      qty = soft[0].trim().replace(/\s+of$/i, "").toLowerCase();
      rest = rest.slice(soft[0].length);
    }
  }
  const tail = rest.match(TRAILING_QTY);
  if (tail && rest.length > tail[0].length) {
    qty = qty ? `${qty}, ${tail[1]}` : tail[1];
    rest = rest.slice(0, rest.length - tail[0].length);
  }
  rest = rest.trim().replace(/^[,\-–]\s*/, "");
  const name = rest ? rest[0].toUpperCase() + rest.slice(1) : text.trim();
  return { qty, name };
}
