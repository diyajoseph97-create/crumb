// Staggered columns, but with the cards in one list in reading order, so the
// keyboard and screen readers go across rows (newest first), not down columns.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Layout = { pos: { x: number; y: number }[]; height: number; colW: number };

const clamp = (min: number, v: number, max: number) => Math.max(min, Math.min(max, v));

export function Masonry({ cols, items }: { cols: number; items: { key: string; node: ReactNode }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last = "";
    const measure = () => {
      const w = el.clientWidth;
      const vw = window.innerWidth;
      const gap = vw <= 640 ? 18 : clamp(18, vw * 0.024, 36);
      const rowGap = vw <= 640 ? 18 : clamp(30, vw * 0.03, 48);
      const colW = (w - gap * (cols - 1)) / cols;
      const heights = new Array(cols).fill(0);
      const kids = Array.from(el.children) as HTMLElement[];
      const pos = kids.map((k) => {
        const c = heights.indexOf(Math.min(...heights)); // shortest column
        const p = { x: Math.round(c * (colW + gap)), y: Math.round(heights[c]) };
        heights[c] += k.offsetHeight + rowGap;
        return p;
      });
      const next = { pos, height: Math.max(0, Math.max(...heights) - rowGap), colW };
      const sig = JSON.stringify(next);
      if (sig !== last) {
        last = sig;
        setLayout(next);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    Array.from(el.children).forEach((k) => ro.observe(k));
    return () => ro.disconnect();
  }, [items, cols]);

  return (
    <div ref={ref} className="masonry2" style={{ height: layout?.height }}>
      {items.map((it, i) => (
        <div
          key={it.key}
          className="m-item"
          style={{
            width: layout ? layout.colW : `calc(${100 / cols}% - 12px)`,
            transform: layout?.pos[i] ? `translate(${layout.pos[i].x}px, ${layout.pos[i].y}px)` : undefined,
          }}
        >
          {it.node}
        </div>
      ))}
    </div>
  );
}
