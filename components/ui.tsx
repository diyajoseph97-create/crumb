"use client";
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

// ---------- Food doodles (used on placeholders & decoration) ----------
export function Doodle({ name, className = "", strokeWidth = 2.2 }: { name: string; className?: string; strokeWidth?: number }) {
  const d: Record<string, React.ReactNode> = {
    egg: <><path d="M32 8c-11 0-18 17-18 27a18 18 0 0 0 36 0C50 25 43 8 32 8Z" /><circle cx="32" cy="36" r="8" /></>,
    bowl: <><path d="M8 30h48a24 24 0 0 1-48 0Z" /><path d="M24 22c0-4 4-4 4-8M34 22c0-4 4-4 4-8" /><path d="M22 54h20" /></>,
    pot: <><path d="M12 26h40v18a10 10 0 0 1-10 10H22a10 10 0 0 1-10-10V26Z" /><path d="M6 26h52M26 20h12" /><path d="M24 14c0-3 3-3 3-6M36 14c0-3 3-3 3-6" /></>,
    chilli: <><path d="M44 12c-2 6 2 10 2 16 0 14-14 26-32 26 8-6 14-14 16-24 2-8 6-14 14-18Z" /><path d="M44 12c0-4 2-6 6-6" /></>,
    leaf: <><path d="M10 54C10 26 26 10 54 10c0 28-16 44-44 44Z" /><path d="M10 54 38 26" /></>,
    swirl: <><path d="M14 42h36l-4 14H18l-4-14Z" /><path d="M18 42c-4-10 6-12 6-18 4 2 10-2 8-10 6 2 12 8 10 16 4 2 4 8 2 12" /></>,
    cup: <><path d="M14 18h30l-4 36H18l-4-36Z" /><path d="M44 26h4a6 6 0 0 1 0 12h-6" /><path d="M24 12c0-3 3-3 3-6M32 12c0-3 3-3 3-6" /></>,
    crumbs: <><circle cx="14" cy="40" r="4" /><circle cx="30" cy="48" r="3" /><circle cx="44" cy="38" r="5" /><circle cx="24" cy="26" r="2.5" /><circle cx="50" cy="22" r="3" /></>,
    sparkle: <path d="M32 6c2 14 8 20 22 22-14 2-20 8-22 22-2-14-8-20-22-22 14-2 20-8 22-22Z" />,
    squiggle: <path d="M4 32c6-12 12-12 18 0s12 12 18 0 12-12 18 0" />,
  };
  return (
    <svg className={`doodle ${className}`} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d[name] ?? d.crumbs}
    </svg>
  );
}

// ---------- Wordmark ----------
export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <button className="logo" onClick={onClick} aria-label="Crumb home">
      <span className="logo-word">crumb</span>
      <span className="logo-dots" aria-hidden="true">
        <i /><i /><i />
      </span>
    </button>
  );
}

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
      title={suggested ? "Suggested by AI. Tap to confirm." : undefined}
    >
      {on && <Icon name="check" size={14} />}
      {label}
      {suggested && <span className="sugg-mark">suggested</span>}
    </button>
  );
}

export function Sticker({ children, tone = "butter", tilt = 0 }: { children: React.ReactNode; tone?: string; tilt?: number }) {
  return (
    <span className={`sticker tone-${tone}`} style={{ transform: `rotate(${tilt}deg)` }}>
      {children}
    </span>
  );
}
