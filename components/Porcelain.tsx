// Hand-drawn blue-and-white porcelain: plates, a bowl, chopsticks and a wave
// border. A small SVG filter gives the lines a slightly wobbly, inked feel and a
// soft wash fills the plates like watercolour.
import React from "react";

let uid = 0;
const nextId = () => `ink${++uid}`;

function InkDefs({ id, wobble = 1.6 }: { id: string; wobble?: number }) {
  return (
    <defs>
      <filter id={`${id}-f`} x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed={uid % 9} />
        <feDisplacementMap in="SourceGraphic" scale={wobble} />
      </filter>
      <radialGradient id={`${id}-wash`} cx="45%" cy="40%" r="65%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
        <stop offset="70%" stopColor="#dfe5f6" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#c3cdee" stopOpacity="0.9" />
      </radialGradient>
      <radialGradient id={`${id}-well`} cx="50%" cy="45%" r="60%">
        <stop offset="0%" stopColor="#fbfbfe" />
        <stop offset="100%" stopColor="#e6eaf7" />
      </radialGradient>
    </defs>
  );
}

/** Repeats a small motif around a circle. */
function Around({ n, r, children, offset = 0 }: { n: number; r: number; children: (i: number) => React.ReactNode; offset?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const a = (360 / n) * i + offset;
        return (
          <g key={i} transform={`rotate(${a} 100 100) translate(100 ${100 - r})`}>
            {children(i)}
          </g>
        );
      })}
    </>
  );
}

const RIMS = ["floral", "wave", "band", "scallop", "ticks", "vine"] as const;
export type Rim = (typeof RIMS)[number];
export const rimFor = (n: number): Rim => RIMS[Math.abs(n) % RIMS.length];

function RimPattern({ rim, w = 1 }: { rim: Rim; w?: number }) {
  const ink = "var(--porcelain)";
  switch (rim) {
    case "floral":
      return (
        <Around n={10} r={82}>
          {() => (
            <g fill={ink}>
              <circle r={3.2 * Math.min(w, 1.6)} cx="0" cy="-3.6" opacity=".85" />
              <circle r="3.2" cx="3.4" cy="-1" opacity=".85" />
              <circle r="3.2" cx="2.1" cy="3" opacity=".85" />
              <circle r="3.2" cx="-2.1" cy="3" opacity=".85" />
              <circle r="3.2" cx="-3.4" cy="-1" opacity=".85" />
              <circle r="1.6" fill="#fff" />
            </g>
          )}
        </Around>
      );
    case "wave": {
      const pts = Array.from({ length: 121 }, (_, i) => {
        const t = (i / 120) * Math.PI * 2;
        const rr = 82 + Math.sin(t * 14) * 3.2;
        return `${100 + Math.cos(t) * rr},${100 + Math.sin(t) * rr}`;
      });
      return <polyline points={pts.join(" ")} fill="none" stroke={ink} strokeWidth={3 * w} strokeLinejoin="round" />;
    }
    case "band":
      return (
        <>
          <circle cx="100" cy="100" r="84" fill="none" stroke={ink} strokeWidth={9 * w} opacity=".9" />
          <circle cx="100" cy="100" r="76" fill="none" stroke={ink} strokeWidth={1.2 * w} />
        </>
      );
    case "scallop":
      return (
        <Around n={18} r={85}>
          {() => <path d="M-14 0 Q0 -10 14 0" fill="none" stroke={ink} strokeWidth={2.4 * w} />}
        </Around>
      );
    case "ticks":
      return (
        <Around n={36} r={84}>
          {(i) => <rect x="-1" y="-1" width={i % 3 === 0 ? 2.6 : 1.6} height={i % 3 === 0 ? 10 : 6} fill={ink} opacity=".9" />}
        </Around>
      );
    case "vine":
      return (
        <>
          <circle cx="100" cy="100" r="82" fill="none" stroke={ink} strokeWidth={1.4 * w} />
          <Around n={14} r={82} offset={6}>
            {(i) => <ellipse cx="0" cy="0" rx="6" ry="2.6" fill={ink} opacity=".8" transform={`rotate(${i % 2 ? 35 : -35})`} />}
          </Around>
        </>
      );
  }
}

/** A top-down plate. */
export function Plate({ rim = "floral", className = "", style, deep = false, w = 1 }: { rim?: Rim; className?: string; style?: React.CSSProperties; deep?: boolean; w?: number }) {
  const id = nextId();
  return (
    <svg className={`porcelain ${className}`} viewBox="0 0 200 200" style={style} aria-hidden="true">
      <InkDefs id={id} />
      <ellipse cx="104" cy="106" rx="94" ry="94" fill="var(--porcelain)" opacity=".07" />
      <g filter={`url(#${id}-f)`}>
        <circle cx="100" cy="100" r="94" fill={`url(#${id}-wash)`} stroke="var(--porcelain)" strokeWidth={2.2 * w} />
        <RimPattern rim={rim} w={w} />
        <circle cx="100" cy="100" r={deep ? 52 : 62} fill={`url(#${id}-well)`} stroke="var(--porcelain)" strokeWidth={1.6 * w} />
        <circle cx="100" cy="100" r={deep ? 46 : 56} fill="none" stroke="var(--porcelain)" strokeWidth={.8 * w} opacity=".55" />
      </g>
    </svg>
  );
}

/** A small dish used as a bullet / icon. */
export function Dish({ i = 0, className = "" }: { i?: number; className?: string }) {
  // Small sizes need heavier lines to read clearly.
  return <Plate rim={rimFor(i)} deep={i % 2 === 1} w={2.6} className={`dish ${className}`} />;
}

export function Chopsticks({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  const id = nextId();
  return (
    <svg className={`porcelain ${className}`} viewBox="0 0 40 220" style={style} aria-hidden="true">
      <InkDefs id={id} wobble={1} />
      <g filter={`url(#${id}-f)`} fill="#f7f8fd" stroke="var(--porcelain)" strokeWidth="1.6">
        <path d="M8 6 L14 6 L13 214 L10 214 Z" />
        <path d="M24 10 L30 10 L28 216 L25 216 Z" />
      </g>
    </svg>
  );
}

/** A small table setting: a few plates and chopsticks (decorative). */
export function TableScene({ className = "" }: { className?: string }) {
  return (
    <div className={`table-scene ${className}`} aria-hidden="true">
      <Plate rim="floral" className="ts ts-1" />
      <Plate rim="band" deep className="ts ts-2" />
      <Plate rim="scallop" className="ts ts-3" />
      <Plate rim="ticks" deep className="ts ts-4" />
      <Plate rim="vine" className="ts ts-5" />
      <Chopsticks className="ts ts-chop" />
    </div>
  );
}

