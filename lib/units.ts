// Switch an ingredient line between cups/ounces and grams/millilitres.
// Only converts amounts it can read reliably; anything else stays as written.
import { formatAmount, parseAmount } from "./scale";

export type UnitSystem = "as-written" | "metric" | "us";

const NUM = "(\\d+(?:\\.\\d+)?(?:\\s+\\d+\\/\\d+)?|\\d+\\/\\d+|\\d*\\s*[¼½¾⅓⅔⅛⅜⅝⅞])";
const LINE = new RegExp(`^\\s*${NUM}\\s*([a-zA-Z.]+)\\b\\.?(.*)$`);

const TO_METRIC: Record<string, [number, "ml" | "g"]> = {
  cup: [240, "ml"], cups: [240, "ml"], c: [240, "ml"],
  "fl oz": [30, "ml"], floz: [30, "ml"],
  pint: [473, "ml"], pints: [473, "ml"], quart: [946, "ml"], quarts: [946, "ml"],
  oz: [28.35, "g"], ounce: [28.35, "g"], ounces: [28.35, "g"],
  lb: [453.6, "g"], lbs: [453.6, "g"], pound: [453.6, "g"], pounds: [453.6, "g"],
};
const FROM_METRIC: Record<string, [number, "ml" | "g"]> = {
  g: [1, "g"], gm: [1, "g"], gms: [1, "g"], gram: [1, "g"], grams: [1, "g"], kg: [1000, "g"],
  ml: [1, "ml"], l: [1000, "ml"], litre: [1000, "ml"], litres: [1000, "ml"], liter: [1000, "ml"], liters: [1000, "ml"],
};

function metric(n: number, unit: "ml" | "g") {
  if (n >= 1000) return `${formatAmount(n / 1000, true)} ${unit === "g" ? "kg" : "l"}`;
  const rounded = n >= 100 ? Math.round(n / 5) * 5 : Math.round(n);
  return `${rounded} ${unit}`;
}
function us(n: number, unit: "ml" | "g") {
  if (unit === "g") {
    const oz = n / 28.35;
    if (oz >= 16) return `${formatAmount(Math.round((oz / 16) * 4) / 4)} lb`;
    return `${formatAmount(Math.max(0.5, Math.round(oz * 2) / 2))} oz`;
  }
  const quarter = (x: number) => Math.max(0.25, Math.round(x * 4) / 4);
  if (n >= 60) { const c = quarter(n / 240); return `${formatAmount(c)} ${c > 1 ? "cups" : "cup"}`; }
  if (n >= 15) return `${formatAmount(quarter(n / 15))} tbsp`;
  return `${formatAmount(quarter(n / 5))} tsp`;
}

export function convertLine(text: string, to: UnitSystem): string {
  if (to === "as-written") return text;
  let t = text.replace(/fl\.?\s*oz/i, "floz");
  const m = t.match(LINE);
  if (!m) return text;
  const amount = parseAmount(m[1].replace(/\s+(?=[¼½¾⅓⅔⅛⅜⅝⅞])/, ""));
  const unit = m[2].toLowerCase().replace(/\.$/, "");
  if (amount == null) return text;
  if (to === "metric" && TO_METRIC[unit]) {
    const [f, u] = TO_METRIC[unit];
    return `${metric(amount * f, u)}${m[3]}`;
  }
  if (to === "us" && FROM_METRIC[unit]) {
    const [f, u] = FROM_METRIC[unit];
    return `${us(amount * f, u)}${m[3]}`;
  }
  return text;
}

/** Which of the two a recipe is mostly written in: cups/ounces ("us") or grams/ml ("metric"). */
export function nativeUnits(lines: string[]): "metric" | "us" {
  let us = 0, met = 0;
  for (const l of lines) {
    const m = l.replace(/fl\.?\s*oz/i, "floz").match(LINE);
    if (!m) continue;
    const u = m[2].toLowerCase().replace(/\.$/, "");
    if (TO_METRIC[u]) us++; else if (FROM_METRIC[u]) met++;
  }
  return us > met ? "us" : "metric";
}
