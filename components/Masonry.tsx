// Staggered columns, but with the cards in one list in reading order, so the
// keyboard and screen readers go across rows (newest first), not down columns.
// Only the first few dozen cards are drawn; more are added as you scroll, so a
// big cookbook opens and filters just as quickly as a small one.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Layout = { pos: { x: number; y: number }[]; height: number; colW: number };

const clamp = (min: number, v: number, max: number) => Math.max(min, Math.min(max, v));
const BATCH = 24;

function sameLayout(a: Layout | null, b: Layout) {
  if (!a || a.height !== b.height || a.colW !== b.colW || a.pos.length !== b.pos.length) return false;
  for (let i = 0; i < a.pos.length; i++) if (a.pos[i].x !== b.pos[i].x || a.pos[i].y !== b.pos[i].y) return false;
  return true;
}

export function Masonry({ cols, items, resetKey }: { cols: number; items: { key: string; node: ReactNode }[]; resetKey?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [limit, setLimit] = useState(BATCH);

  // A new search or filter starts from the top again.
  useEffect(() => setLimit(BATCH), [resetKey]);

  const shown = useMemo(() => (items.length > limit ? items.slice(0, limit) : items), [items, limit]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const w = el.clientWidth;
      const vw = window.innerWidth;
      const gap = vw <= 640 ? 18 : clamp(18, vw * 0.024, 36);
      const rowGap = vw <= 640 ? 18 : clamp(30, vw * 0.03, 48);
      const colW = (w - gap * (cols - 1)) / cols;
      const heights = new Array(cols).fill(0);
      const kids = Array.from(el.children) as HTMLElement[];
      const pos = kids.map((k) => {
        let c = 0;
        for (let i = 1; i < cols; i++) if (heights[i] < heights[c]) c = i; // shortest column
        const p = { x: Math.round(c * (colW + gap)), y: Math.round(heights[c]) };
        heights[c] += k.offsetHeight + rowGap;
        return p;
      });
      const next = { pos, height: Math.max(0, Math.max(...heights) - rowGap), colW };
      setLayout((prev) => (sameLayout(prev, next) ? prev : next));
    };
    // Photos finishing loading fire many resizes at once: lay out once per frame.
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    Array.from(el.children).forEach((k) => ro.observe(k));
    return () => { ro.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [shown, cols]);

  // Draw the next batch when the end of the list comes near.
  const hasMore = items.length > limit;
  useEffect(() => {
    const s = more.current;
    if (!s || !hasMore) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) setLimit((n) => n + BATCH); }, { rootMargin: "1200px 0px" });
    io.observe(s);
    return () => io.disconnect();
  }, [hasMore, limit]);

  return (
    <>
      <div ref={ref} className="masonry2" style={{ height: layout?.height }}>
        {shown.map((it, i) => (
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
      {hasMore && <div ref={more} className="masonry-more" aria-hidden="true" />}
    </>
  );
}
