import React, { useEffect, useRef } from "react";
import { Mark } from "./Shapes";

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

// ---------- Decorative mark (empty states, welcome) ----------
const DOODLE_TONE: Record<string, number> = { pot: 0, bowl: 2, egg: 1, crumbs: 3, sparkle: 2, chilli: 4, leaf: 3, swirl: 1, cup: 5 };
export function Doodle({ name, className = "" }: { name: string; className?: string; strokeWidth?: number }) {
  return <Mark tone={DOODLE_TONE[name] ?? 0} className={`doodle ${className}`} />;
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
import { createContext, useContext } from "react";
export type ViewOnlyInfo = { on: boolean; singleRecipe?: boolean };
export const ViewOnlyContext = createContext<ViewOnlyInfo>({ on: false });
export const useViewOnly = () => useContext(ViewOnlyContext);
