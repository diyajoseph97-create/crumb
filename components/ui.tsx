import React, { useEffect, useRef } from "react";

// ---------- Icons (simple line icons, 24px grid) ----------
const PATHS: Record<string, React.ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></>,
  users: <><circle cx="9" cy="9" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 6.5a3 3 0 0 1 0 5.5M17.5 19a5 5 0 0 0-2.2-4.2" /></>,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
  trash: <><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5H5V6h5" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" /><circle cx="12" cy="13" r="3.5" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  back: <path d="M15 5 8 12l7 7" />,
  up: <path d="m6 15 6-6 6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  image: <><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m5 18 5-5 3 3 2-2 4 4" /></>,
  pen: <><path d="M4 20h4L19 9l-4-4L4 16v4Z" /></>,
  alert: <><path d="M12 4 2.5 20h19L12 4Z" /><path d="M12 10v4M12 17h.01" /></>,
  sparkle: <path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7Z" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>,
  download: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M5 19h14" /></>,
  upload: <><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" /><path d="M5 19h14" /></>,
  bookmark: <path d="M7 4h10v16l-5-4-5 4V4Z" />,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></>,
  star: <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L12 4Z" />,
  chef: <><path d="M7 14a4 4 0 1 1 1.5-7.7A4 4 0 0 1 16 6a3.5 3.5 0 1 1 1 8" /><path d="M7 14v5h10v-5" /></>,
  share: <><path d="M12 15V4M8 8l4-4 4 4" /><path d="M5 12v7h14v-7" /></>,
  play: <><circle cx="12" cy="12" r="9" /><path d="m10 8.5 5.5 3.5L10 15.5v-7Z" /></>,
};

export function Icon({ name, size = 20, filled = false, className = "" }: { name: string; size?: number; filled?: boolean; className?: string }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

// ---------- The crumbs mark: three pixel crumbs (empty states, welcome) ----------
export function Doodle({ className = "" }: { name?: string; className?: string; strokeWidth?: number }) {
  return (
    <svg className={`doodle ${className}`} viewBox="0 0 24 16" aria-hidden="true" shapeRendering="crispEdges">
      <rect x="2" y="9" width="5" height="5" fill="currentColor" />
      <rect x="10" y="4" width="4" height="4" fill="currentColor" />
      <rect x="17" y="10" width="3" height="3" fill="currentColor" />
    </svg>
  );
}

// ---------- Wordmark: "crumb" in an outlined pill ----------
// ---------- Modal / sheet ----------
export function Modal({
  open, onClose, children, label, variant = "dialog",
}: { open: boolean; onClose: () => void; children: React.ReactNode; label: string; variant?: "dialog" | "sheet" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    setTimeout(() => ref.current?.querySelector<HTMLElement>("input,button,textarea")?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={`overlay overlay-${variant}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal modal-${variant}`} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open, title, body, confirmLabel, onConfirm, onCancel,
}: { open: boolean; title: string; body: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal open={open} onClose={onCancel} label={title}>
      <div className="confirm">
        <h2 className="h-display h-md">{title}</h2>
        <p className="muted">{body}</p>
        <div className="row gap-sm end">
          <button className="btn btn-ghost" onClick={onCancel}>Keep it</button>
          <button className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- Toggle chip (filters / editor) ----------
export function ToggleChip({
  label, on, onClick, tone = "default", suggested = false,
}: { label: string; on: boolean; onClick: () => void; tone?: "default" | "cobalt" | "tomato" | "butter" | "tangerine"; suggested?: boolean }) {
  return (
    <button
      type="button"
      className={`tchip tone-${tone} ${on ? "on" : ""} ${suggested ? "suggested" : ""}`}
      aria-pressed={on}
      onClick={onClick}
      title={suggested ? "Suggested. Tap to confirm." : undefined}
    >
      {on && <Icon name="check" size={14} />}
      {label}
      {suggested && <span className="sugg-mark">suggested</span>}
    </button>
  );
}


// ---------- View-only mode (someone opened a link you shared) ----------
import { createContext, useContext, useState } from "react";
export type ViewOnlyInfo = { on: boolean; singleRecipe?: boolean };
export const ViewOnlyContext = createContext<ViewOnlyInfo>({ on: false });
export const useViewOnly = () => useContext(ViewOnlyContext);

// ---------- Pixel icons (8×8, drawn like the pixel type) ----------
const PIXELS: Record<string, string[]> = {
  pot: ["........", "..####..", "########", ".#....#.", ".#....#.", ".#....#.", "..####..", "........"],
  flame: ["...#....", "...##...", "..###...", "..####.#", ".#####.#", ".#######", "########", ".######."],
  clock: ["..####..", ".#....#.", "#...#..#", "#...#..#", "#...###.", "#......#", ".#....#.", "..####.."],
  bowl: ["........", "........", "########", "########", ".######.", "..####..", "...##...", "........"],
  check: ["........", ".......#", "......##", "#....##.", "##..##..", ".####...", "..##....", "........"],
};
export function PixelIcon({ name, size = 12 }: { name: keyof typeof PIXELS | string; size?: number }) {
  const rows = PIXELS[name] ?? [];
  return (
    <svg className="picon" viewBox="0 0 8 8" width={size} height={size} fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
      {rows.flatMap((row, y) => [...row].map((ch, x) => (ch === "#" ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null)))}
    </svg>
  );
}

// ---------- Round stamp with text running around it ----------
let stampSeq = 0;
export function Stamp({ text, size = 120, rotate = -10, className = "", icon }: { text: string; size?: number; rotate?: number; className?: string; icon?: React.ReactNode }) {
  const id = `ring${++stampSeq}`;
  // Repeat the words so they go all the way round.
  let ring = `${text.toUpperCase()} · `;
  while (ring.length < 38) ring += `${text.toUpperCase()} · `;
  return (
    <svg className={`stamp ${className}`} viewBox="0 0 120 120" width={size} height={size} style={{ transform: `rotate(${rotate}deg)` }} role="img" aria-label={text}>
      <defs><path id={id} d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" /></defs>
      <circle cx="60" cy="60" r="57" fill="var(--bg)" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="33" fill="none" stroke="currentColor" strokeWidth="1" />
      <text fontSize={ring.length > 46 ? 9 : 10.5} fontWeight="500" letterSpacing={ring.length > 46 ? 1.4 : 2.2} fill="currentColor" style={{ fontFamily: "var(--font)" }} textLength="270" lengthAdjust="spacing">
        <textPath href={`#${id}`}>{ring}</textPath>
      </text>
      {icon ? (
        <g transform="translate(40 40)" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icon}</g>
      ) : (
        <g fill="currentColor" shapeRendering="crispEdges">
          <rect x="44" y="62" width="9" height="9" /><rect x="57" y="52" width="7" height="7" /><rect x="68" y="64" width="5" height="5" />
        </g>
      )}
    </svg>
  );
}

// ---------- Hand-drawn diet icons for the stamp (40×40, drawn with a slightly wobbly pen) ----------
const slash = <path d="M9 31 C16 24 24 16 31.5 8.5" />;
const DIET_ICONS: Record<string, React.ReactNode> = {
  "High protein": (
    <>
      <path d="M8.5 30.5 C7.5 24 10.5 19.5 15.5 18.6 C16.4 13.4 19.2 9.2 23.4 8.6 C26.6 8.2 28.2 10.9 26.4 13.1 L23.6 15.4 C22.6 17.2 22.9 19.1 24.4 19.9 C28.9 18.9 32.4 21.6 32.1 25.6 C31.8 29.6 27.9 31.9 22.1 31.6 L12.4 31.7 C10.2 31.8 8.8 31.4 8.5 30.5 Z" />
      <path d="M16.6 24.6 C18.8 22.3 22.1 22.1 24.4 24.2" />
    </>
  ),
  Vegetarian: (
    <>
      <path d="M9.5 30.5 C9.2 19.4 17.4 10.1 30.8 9.4 C31.1 22.3 22.6 30.6 9.5 30.5 Z" />
      <path d="M9.8 30.2 C14.6 24.8 19.4 20.1 25.2 15.4" />
    </>
  ),
  Vegan: (
    <>
      <path d="M20 32 C20.3 27.4 19.8 23.6 20.1 20.2" />
      <path d="M20.1 22.4 C14.2 22.6 10.6 18.9 10.4 13 C16.2 12.8 20.1 16.4 20.1 22.4 Z" />
      <path d="M20.2 20.3 C20 14.1 23.8 10 29.8 9.8 C30 16 26.1 20.1 20.2 20.3 Z" />
    </>
  ),
  "Gluten-free": (
    <>
      <path d="M20 32 C20.2 25 19.8 17 20.1 9" />
      <path d="M20 15 C17 14.6 15.4 12.6 15.6 10 C18.2 10.2 19.8 12.2 20 15" /><path d="M20.1 15 C23 14.6 24.6 12.6 24.4 10 C21.8 10.2 20.2 12.2 20.1 15" />
      <path d="M20 21 C17 20.6 15.4 18.6 15.6 16 C18.2 16.2 19.8 18.2 20 21" /><path d="M20.1 21 C23 20.6 24.6 18.6 24.4 16 C21.8 16.2 20.2 18.2 20.1 21" />
      {slash}
    </>
  ),
  "Dairy-free": (
    <>
      <path d="M14.2 14.4 L14 31.6 L26.1 31.8 L25.8 14.2 L22.4 8.4 L17.6 8.6 Z" /><path d="M14.3 14.5 C18 14.1 22 14.3 25.7 14.3" />
      {slash}
    </>
  ),
  "Egg-free": (
    <>
      <path d="M20 8.4 C25.6 8.2 30.2 17.6 30 23.6 C29.8 28.8 25.8 31.8 20 31.7 C14.2 31.8 10.2 28.8 10.1 23.6 C9.9 17.6 14.4 8.6 20 8.4 Z" />
      {slash}
    </>
  ),
  "High fibre": (
    <>
      <path d="M20 32 C20.2 25 19.8 17 20.1 9" />
      <path d="M20 15 C17 14.6 15.4 12.6 15.6 10 C18.2 10.2 19.8 12.2 20 15" /><path d="M20.1 15 C23 14.6 24.6 12.6 24.4 10 C21.8 10.2 20.2 12.2 20.1 15" />
      <path d="M20 21 C17 20.6 15.4 18.6 15.6 16 C18.2 16.2 19.8 18.2 20 21" /><path d="M20.1 21 C23 20.6 24.6 18.6 24.4 16 C21.8 16.2 20.2 18.2 20.1 21" />
      <path d="M20 27 C17 26.6 15.4 24.6 15.6 22 C18.2 22.2 19.8 24.2 20 27" /><path d="M20.1 27 C23 26.6 24.6 24.6 24.4 22 C21.8 22.2 20.2 24.2 20.1 27" />
    </>
  ),
};
// Anything else (low carb, a cuisine…): a steaming bowl.
const BOWL = (
  <>
    <path d="M8.2 20.4 C15.8 20 24 20.2 31.8 20.3 C31.6 27.2 26.8 31.5 20 31.6 C13.2 31.5 8.4 27.2 8.2 20.4 Z" />
    <path d="M16 16.4 C14.2 14 17.6 12.4 15.9 9.6" /><path d="M22.4 16.4 C20.6 14 24 12.4 22.3 9.6" />
  </>
);
export const dietIcon = (tag: string | undefined) => (tag && DIET_ICONS[tag]) || BOWL;

// ---------- A dropdown that looks like the rest of crumbs (not the browser's) ----------
export function Dropdown<T extends string>({ value, options, onChange, label, className = "" }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);
  const pick = (v: T) => { onChange(v); setOpen(false); (wrap.current?.querySelector(".dd-trigger") as HTMLElement | null)?.focus(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); setActive(Math.max(0, options.indexOf(current))); setOpen(true); return; }
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(options[active].value); }
    else if (e.key === "Tab") setOpen(false);
  };
  return (
    <div className={`dd ${open ? "open" : ""} ${className}`} ref={wrap} onKeyDown={onKey}>
      <button type="button" className="dd-trigger" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${current?.label}`} onClick={() => { setActive(Math.max(0, options.indexOf(current))); setOpen((o) => !o); }}>
        <span>{current?.label}</span><span aria-hidden="true" className="dd-arrow">↓</span>
      </button>
      {open && (
        <ul className="dd-list" role="listbox" aria-label={label}>
          {options.map((o, i) => (
            <li key={o.value} role="option" aria-selected={o.value === value} className={`${o.value === value ? "on" : ""} ${i === active ? "active" : ""}`} onMouseEnter={() => setActive(i)} onClick={() => pick(o.value)}>
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- "⋯" menu for less-used actions ----------
export type MenuItem = { label: string; onSelect: () => void; danger?: boolean; pressed?: boolean };
export function OverflowMenu({ items, label = "More actions" }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    // Open upwards when there isn't room below (the recipe column is pinned, so it can't scroll)
    const r = btn.current?.getBoundingClientRect();
    if (r) setUp(window.innerHeight - r.bottom < items.length * 44 + 24 && r.top > window.innerHeight - r.bottom);
    const off = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    (wrap.current?.querySelector('[role="menuitem"]') as HTMLElement | null)?.focus();
    return () => document.removeEventListener("mousedown", off);
  }, [open]);
  const onKey = (e: React.KeyboardEvent) => {
    if (!open) return;
    const els = Array.from(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); btn.current?.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === "Tab") setOpen(false);
  };
  return (
    <div className="menu" ref={wrap} onKeyDown={onKey}>
      <button ref={btn} type="button" className="menu-trigger" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
      </button>
      {open && (
        <ul className={`menu-list${up ? " up" : ""}`} role="menu" aria-label={label}>
          {items.map((it) => (
            <li key={it.label} role="none">
              <button role="menuitem" type="button" className={it.danger ? "danger" : ""} aria-pressed={it.pressed} onClick={() => { setOpen(false); it.onSelect(); }}>{it.label}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
